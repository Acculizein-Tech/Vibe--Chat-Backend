import Conversation from "../models/Conversation.js";  
import Message from "../models/Message.js";  
import UserContact from "../models/UserContact.js";  
import User from "../models/user.js";  
import GroupConversation from "../models/GroupConversation.js";
import { decryptMessageText } from "../utils/messageCrypto.js";
import mongoose from "mongoose";
import { onlineUsers } from "../utils/socketState.js";
const CHAT_USERS_CACHE_TTL_MS = 0;
const chatUsersCache = new Map();
const mediaPreviewLabel = (media = []) => {
  const list = Array.isArray(media) ? media : [];
  if (!list.length) return "";
  const firstType = String(list[0]?.type || "").trim().toLowerCase();
  if (firstType === "image") return list.length > 1 ? "Photos" : "Photo";
  if (firstType === "video") return list.length > 1 ? "Videos" : "Video";
  if (firstType === "audio") return list.length > 1 ? "Audios" : "Audio";
  return list.length > 1 ? "Documents" : "Document";
};
const isGenericMediaLabel = (value = "") => {
  const normalized = String(value || "")
    .trim()
    .replace(/^forwarded\s*:?\s*/i, "")
    .toLowerCase();
  if (!normalized) return false;
  return [
    "photo",
    "photos",
    "image",
    "images",
    "video",
    "videos",
    "audio",
    "audios",
    "document",
    "documents",
    "file",
    "files",
    "pdf",
  ].includes(normalized);
};
// ✅ Create or get existing conversation between two users  
  
   
// ✅ Get all conversations for a user  
export const getUserConversations = async (req, res) => {  
  try {  
    const { userId } = req.params;  
    const conversations = await Conversation.find({  
      participants: userId,  
    })  
      .populate("participants", "name email")  
      .populate("lastMessage");  
    const cache = new Map();
    const hydrated = await Promise.all(
      conversations.map(async (conv) => {
        const plain = conv.toObject();
        if (plain.lastMessage) {
          plain.lastMessage.text = await decryptMessageText(plain.lastMessage, cache);
        }
        return plain;
      }),
    );
    res.status(200).json(hydrated);  
  } catch (error) {  
    res.status(500).json({ error: error.message });  
  }  
};  
  
  
//new  
export const getOrCreateConversation = async (req, res) => {  
  try {  
    // const { senderId, receiverId, receiverPhone } = req.body;  
    const senderId = req.user._id; // ✅ Extract from token  
    const { receiverId, receiverPhone } = req.body;  
    console.log("senderId:", senderId, "receiverId:", receiverId, "receiverPhone:", receiverPhone);  
    if (!senderId)  
      return res.status(400).json({ message: "SenderId required" });  
  
    // 🧩 CASE 1: When receiver is registered  
    if (receiverId) {  
      let conversation = await Conversation.findOne({  
        participants: { $all: [senderId, receiverId] },  
        isGroup: false,  
      });  
  
      if (!conversation) {  
        conversation = await Conversation.create({  
          participants: [senderId, receiverId],  
          status: "active",  
        });  
      }  
  
      return res.status(200).json({  
        message: "Active conversation ready",  
        status: "active",  
        conversation,  
      });  
    }  
  
    // 🧩 CASE 2: When receiver is not registered yet  
    if (receiverPhone) {  
      // Check if already a pending conversation exists  
      let pending = await Conversation.findOne({  
        senderId,  
        receiverPhone,  
        status: "pending",  
      });  
  
      if (!pending) {  
        pending = await Conversation.create({  
          participants: [senderId],  
          receiverPhone,  
          status: "pending",  
        });  
      }  
  
      return res.status(200).json({  
        message: "Pending conversation created (user not registered yet)",  
        status: "pending",  
        conversation: pending,  
      });  
    }  
  
    res.status(400).json({ message: "Either receiverId or receiverPhone required" });  
  } catch (error) {  
    console.error("❌ Error in getOrCreateConversation:", error);  
    res.status(500).json({ message: "Server error", error: error.message });  
  }  
};  

export const createGroupConversation = async (req, res) => {
  try {
    const creatorId = req.user?._id;
    const { participantIds = [], groupName = "" } = req.body || {};

    if (!creatorId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const cleanName = String(groupName || "").trim();
    if (!cleanName) {
      return res.status(400).json({ message: "Group name is required" });
    }

    const validParticipantIds = Array.from(
      new Set(
        (Array.isArray(participantIds) ? participantIds : [])
          .map((id) => String(id || "").trim())
          .filter((id) => mongoose.Types.ObjectId.isValid(id)),
      ),
    );

    const participants = Array.from(
      new Set([String(creatorId), ...validParticipantIds]),
    ).map((id) => new mongoose.Types.ObjectId(id));

    if (participants.length < 2) {
      return res.status(400).json({
        message: "At least one valid participant is required to create group",
      });
    }

    const groupConversation = await GroupConversation.create({
      participants,
      groupName: cleanName,
      createdBy: creatorId,
      admins: [creatorId],
      status: "active",
    });

    const io = req.app.get("io");
    if (io) {
      const creatorName =
        req.user?.fullName ||
        req.user?.username ||
        req.user?.phone ||
        "Someone";
      const payload = {
        conversationId: String(groupConversation._id),
        action: "group:created",
        type: "group",
        name: cleanName,
        avatar: String(groupConversation.groupAvatar || ""),
        text: `Group created by ${creatorName}`,
        createdAt: new Date().toISOString(),
      };
      participants.forEach((pid) => {
        const uid = String(pid);
        io.to(`user:${uid}`).emit("chat:list:refresh", payload);
        io.to(`user:${uid}`).emit("chat:list:patch", payload);
        const sid = onlineUsers.get(uid);
        if (sid) {
          io.to(sid).emit("chat:list:refresh", payload);
          io.to(sid).emit("chat:list:patch", payload);
        }
      });
    }

    return res.status(201).json({
      message: "Group conversation created",
      groupConversation,
    });
  } catch (error) {
    console.error("createGroupConversation error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
  
//get those users whose have the converstaion with the logged in user  
// Get all users who have a conversation with the logged-in user  
export const getChatUsers = async (req, res) => {
  try {
    const ownerId = req.user._id;
    const cacheKey = String(ownerId || "");
    const now = Date.now();
    const cached = chatUsersCache.get(cacheKey);
    if (cached && now - cached.ts < CHAT_USERS_CACHE_TTL_MS) {
      return res.json(cached.payload);
    }

    const conversations = await Conversation.find({
      participants: ownerId,
    }).lean();

    const uniqueUsers = [];
    const cache = new Map();

    const groupConversations = await GroupConversation.find({
      participants: ownerId,
    })
      .populate("createdBy", "fullName firstName lastName username phone")
      .lean();

    const groupLastMessageIds = Array.from(
      new Set(
        (groupConversations || [])
          .map((group) => String(group?.lastMessage || ""))
          .filter((id) => mongoose.Types.ObjectId.isValid(id)),
      ),
    );
    const groupLastMessages = groupLastMessageIds.length
      ? await Message.find({ _id: { $in: groupLastMessageIds } })
          .select(
            "text encryptedText textIv textAuthTag isEncrypted conversationId createdAt media",
          )
          .lean()
      : [];
    const groupLastMessageById = new Map(
      (groupLastMessages || []).map((msg) => [String(msg?._id || ""), msg]),
    );

    for (const group of groupConversations) {
      const lastMessage =
        group.lastMessage && mongoose.Types.ObjectId.isValid(group.lastMessage)
          ? groupLastMessageById.get(String(group.lastMessage)) || null
          : null;

      const lastMessageText = lastMessage
        ? await decryptMessageText(lastMessage, cache)
        : null;
      const lastMessageTextValue = String(lastMessageText || "").trim();
      const mediaPreview = mediaPreviewLabel(lastMessage?.media);
      const lastMessagePreview =
        mediaPreview && isGenericMediaLabel(lastMessageTextValue)
          ? mediaPreview
          : lastMessageTextValue || mediaPreview;

      const createdByName =
        group?.createdBy?.fullName ||
        [group?.createdBy?.firstName, group?.createdBy?.lastName]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        group?.createdBy?.username ||
        group?.createdBy?.phone ||
        "Unknown";

      uniqueUsers.push({
        conversationId: group._id,
        type: "group",
        participant: {
          receiver: null,
          fullName: group.groupName || "Unnamed Group",
          phone: "",
          userImages: [],
          profileAvatar: group.groupAvatar || null,
          existingName: null,
          existingUserId: null,
          lastMessage: lastMessagePreview || null,
          lastMessageAt: lastMessage?.createdAt || null,
          groupCreatedBy: createdByName,
        },
      });
    }

    const directConversationIds = (conversations || [])
      .map((convo) => convo?._id)
      .filter(Boolean);
    const latestDirectMessageAgg = directConversationIds.length
      ? await Message.aggregate([
          { $match: { conversationId: { $in: directConversationIds } } },
          { $sort: { createdAt: -1 } },
          {
            $group: {
              _id: "$conversationId",
              doc: { $first: "$$ROOT" },
            },
          },
        ])
      : [];
    const latestDirectMessageByConversationId = new Map(
      (latestDirectMessageAgg || []).map((row) => [
        String(row?._id || ""),
        row?.doc || null,
      ]),
    );

    const otherUserIds = Array.from(
      new Set(
        (conversations || [])
          .map((convo) =>
            (convo?.participants || []).find(
              (id) => String(id) !== String(ownerId),
            ),
          )
          .filter(Boolean)
          .map((id) => String(id)),
      ),
    );
    const users = otherUserIds.length
      ? await User.find({ _id: { $in: otherUserIds } })
          .select("fullName firstName lastName phone username profile.avatar userImages")
          .lean()
      : [];
    const userById = new Map(
      (users || []).map((user) => [String(user?._id || ""), user]),
    );
    const contacts = otherUserIds.length
      ? await UserContact.find({
          owner: ownerId,
          linkedUser: { $in: otherUserIds },
          isBlocked: false,
        }).lean()
      : [];
    const contactByLinkedUserId = new Map(
      (contacts || []).map((contact) => [String(contact?.linkedUser || ""), contact]),
    );

    for (const convo of conversations) {
      const otherUserId = (convo?.participants || []).find(
        (id) => String(id) !== String(ownerId),
      );
      if (!otherUserId) continue;

      const user = userById.get(String(otherUserId)) || null;
      const contact = contactByLinkedUserId.get(String(otherUserId)) || null;
      if (!user && !contact) continue;

      const userFullName =
        user?.fullName ||
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        user?.username ||
        "";
      const lastMessage =
        latestDirectMessageByConversationId.get(String(convo._id)) || null;
      const lastMessageText = lastMessage
        ? await decryptMessageText(lastMessage, cache)
        : null;
      const lastMessageTextValue = String(lastMessageText || "").trim();
      const mediaPreview = mediaPreviewLabel(lastMessage?.media);
      const lastMessagePreview =
        mediaPreview && isGenericMediaLabel(lastMessageTextValue)
          ? mediaPreview
          : lastMessageTextValue || mediaPreview;

      uniqueUsers.push({
        conversationId: convo._id,
        type: "individual",
        participant: {
          receiver: otherUserId,
          fullName: userFullName,
          phone: user?.phone || "",
          userImages: user?.userImages || [],
          profileAvatar: user?.profile?.avatar || null,
          existingName: contact
            ? `${contact.firstName} ${contact.lastName}`.trim()
            : null,
          existingUserId: contact ? contact._id : null,
          lastMessage: lastMessagePreview || null,
          lastMessageAt: lastMessage?.createdAt || null,
        },
      });
    }

    const payload = { status: "Success", uniqueUsers };
    chatUsersCache.set(cacheKey, { ts: now, payload });
    res.json(payload);
  } catch (err) {
    console.error("getChatUsers error", err);
    res.status(500).json({ status: "Error", message: err.message });
  }
};
//\delete a conversation by ID
export const deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ message: "Conversation not found" });
    }

    // Check if the logged-in user is a participant of the conversation
    if (!conversation.participants.includes(req.user._id)) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await Conversation.findByIdAndDelete(conversationId);
    await Message.deleteMany({ conversationId });

    res.json({ message: "Conversation and its messages deleted successfully" });
  } catch (error) {
    console.error("❌ deleteConversation error", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

