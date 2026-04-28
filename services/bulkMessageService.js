import mongoose from "mongoose";
import User from "../models/user.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Notification from "../models/Notification.js";
import { io } from "../index.js";
import { onlineUsers, activeConversationViewers } from "../utils/socketState.js";
import { encryptMessageText, materializeMessageForClient } from "../utils/messageCrypto.js";
import { sendPushNotification } from "../utils/pushService.js";
import { buildPhoneLookupCandidates, normalizePhoneNumber } from "../utils/phoneNormalizer.js";

const inferMediaTypeFromUrl = (url = "") => {
  const clean = String(url || "").trim().toLowerCase().split("?")[0];
  if (!clean) return "file";
  if (/\.(jpg|jpeg|png|gif|webp|avif|bmp|svg)$/.test(clean)) return "image";
  if (/\.(mp4|mov|avi|mkv|webm)$/.test(clean)) return "video";
  if (/\.(mp3|wav|ogg|m4a|aac|flac)$/.test(clean)) return "audio";
  return "file";
};

const normalizeId = (value) => String(value || "").trim();

const getActiveSocketId = (userId) => {
  const uid = normalizeId(userId);
  if (!uid) return "";
  const sid = normalizeId(onlineUsers.get(uid));
  if (!sid) return "";
  const socketRef = io?.sockets?.sockets?.get(sid);
  if (!socketRef || socketRef.disconnected) {
    if (onlineUsers.get(uid) === sid) {
      onlineUsers.delete(uid);
    }
    return "";
  }
  return sid;
};

const emitToUser = (userId, event, payload) => {
  const uid = normalizeId(userId);
  if (!uid) return;
  io.to(`user:${uid}`).emit(event, payload);
  const sid = getActiveSocketId(uid);
  if (sid) io.to(sid).emit(event, payload);
};

const truncatePreview = (value, max = 80) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}...`;
};

const buildMediaPreviewLabel = (media = []) => {
  const firstType = normalizeId(media?.[0]?.type).toLowerCase();
  if (!firstType) return "Media";
  if (firstType === "image") return media.length > 1 ? "Photos" : "Photo";
  if (firstType === "video") return media.length > 1 ? "Videos" : "Video";
  if (firstType === "audio") return media.length > 1 ? "Audios" : "Audio";
  return media.length > 1 ? "Documents" : "Document";
};

const buildMediaPreviewKind = (media = []) => {
  const firstType = normalizeId(media?.[0]?.type).toLowerCase();
  if (firstType === "image") return "image";
  if (firstType === "video") return "video";
  if (firstType === "audio") return "audio";
  if (firstType) return "document";
  return null;
};

const findTargetUserByPhone = async (normalizedPhone) => {
  const parsed = normalizePhoneNumber(normalizedPhone);
  if (!parsed.isValid) return null;

  const candidates = buildPhoneLookupCandidates(parsed.e164, parsed.local);
  const direct = await User.findOne({ phone: { $in: candidates } })
    .select("_id phone")
    .lean();
  if (direct) return direct;

  // Fallback: last-10-digit regex match for older stored formats.
  const localEscaped = String(parsed.local || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return User.findOne({ phone: { $regex: `${localEscaped}$` } })
    .select("_id phone")
    .lean();
};

const getOrCreateConversation = async ({ senderId, receiverId, receiverPhone }) => {
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

    return conversation;
  }

  let pendingConversation = await Conversation.findOne({
    participants: senderId,
    receiverPhone,
    isGroup: false,
    status: "pending",
  });

  if (!pendingConversation) {
    pendingConversation = await Conversation.create({
      participants: [senderId],
      receiverPhone,
      status: "pending",
    });
  }

  return pendingConversation;
};

export const dispatchBulkMessageToContact = async ({
  senderId,
  phone,
  text,
  mediaUrl,
  mediaUrls,
}) => {
  const senderObjectId = new mongoose.Types.ObjectId(senderId);
  const normalized = normalizePhoneNumber(phone);
  if (!normalized.isValid) {
    throw new Error("Invalid phone number");
  }

  const targetUser = await findTargetUserByPhone(normalized.e164);
  const receiverId = targetUser?._id ? new mongoose.Types.ObjectId(targetUser._id) : null;

  const conversation = await getOrCreateConversation({
    senderId: senderObjectId,
    receiverId,
    receiverPhone: receiverId ? undefined : normalized.e164,
  });

  const safeText = String(text || "").trim();
  const safeMediaUrl = String(mediaUrl || "").trim();
  const safeMediaUrls = Array.isArray(mediaUrls)
    ? mediaUrls.map((url) => String(url || "").trim()).filter(Boolean)
    : [];
  const resolvedMediaUrls = safeMediaUrls.length
    ? safeMediaUrls
    : safeMediaUrl
      ? [safeMediaUrl]
      : [];

  const encrypted = safeText
    ? await encryptMessageText({ conversationId: conversation._id, text: safeText })
    : {
        text: "",
        encryptedText: "",
        textIv: "",
        textAuthTag: "",
        textAlg: "aes-256-gcm",
        encryptionVersion: 1,
        isEncrypted: false,
      };

  const media = resolvedMediaUrls.map((url) => ({
    url,
    type: inferMediaTypeFromUrl(url),
    thumbnailUrl: "",
    fileName: url.split("/").pop() || "attachment",
    mimeType: "",
    sizeBytes: null,
    pageCount: null,
  }));

  const message = await Message.create({
    conversationId: conversation._id,
    sender: senderObjectId,
    receiver: receiverId || normalized.e164,
    deliveryInfo: [],
    readBy: [senderObjectId],
    readInfo: [{ userId: senderObjectId, readAt: new Date() }],
    ...encrypted,
    media,
    status: "sent",
  });

  await Conversation.findByIdAndUpdate(conversation._id, {
    lastMessage: message._id,
    ...(receiverId ? { status: "active" } : {}),
  });

  const outgoing = await materializeMessageForClient(message);
  const conversationId = String(conversation._id);
  const senderIdText = String(senderObjectId);
  const receiverIdText = receiverId ? String(receiverId) : "";

  io.to(conversationId).emit("messageReceived", outgoing);
  emitToUser(senderIdText, "messageReceived", outgoing);
  if (receiverIdText) {
    emitToUser(receiverIdText, "messageReceived", outgoing);
  }

  const previewLabel = safeText || buildMediaPreviewLabel(media);
  const chatListPayload = {
    conversationId,
    messageId: outgoing?._id,
    text: previewLabel,
    forwarded: false,
    previewKind: buildMediaPreviewKind(media),
    media,
    sender: senderIdText,
    receiver: receiverIdText || null,
    status: outgoing?.status || "sent",
    createdAt: message.createdAt || new Date(),
  };
  emitToUser(senderIdText, "chat:list:update", chatListPayload);
  if (receiverIdText) {
    emitToUser(receiverIdText, "chat:list:update", chatListPayload);
  }

  if (receiverIdText) {
    const viewers = activeConversationViewers.get(conversationId) || new Set();
    if (!viewers.has(receiverIdText)) {
      try {
        const senderUser = await User.findById(senderObjectId)
          .select("fullName username phone")
          .lean();
        const receiverUser = await User.findById(receiverIdText).select("pushToken").lean();
        const senderLabel =
          String(
            senderUser?.fullName || senderUser?.username || senderUser?.phone || "Ryngales",
          ).trim() || "Ryngales";
        const previewText = truncatePreview(previewLabel, 80);
        const threadKey = `chat:${conversationId}`;

        const notification = await Notification.create({
          recipient: receiverIdText,
          scope: "USER",
          type: "NEW_MESSAGE",
          title: "New Message",
          message: previewText || "New message",
          data: {
            conversationId,
            senderId: senderIdText,
            isGroup: false,
            groupName: "",
            senderLabel,
            threadKey,
          },
          isRead: false,
        });

        emitToUser(receiverIdText, "newNotification", notification);
        const unreadCount = await Notification.countDocuments({
          recipient: receiverIdText,
          isRead: false,
        });
        emitToUser(receiverIdText, "unreadCount", unreadCount);

        const pushToken = String(receiverUser?.pushToken || "").trim();
        if (pushToken) {
          await sendPushNotification({
            pushToken,
            title: `${senderLabel} • Ryngales`,
            body: previewText || "New message",
            threadKey,
            data: {
              type: "CHAT_MESSAGE",
              conversationId,
              senderId: senderIdText,
              isGroup: false,
              groupName: "",
              senderLabel,
              threadKey,
            },
          });
        }
      } catch (notifyErr) {
        console.error("bulk message realtime side-effect error:", notifyErr?.message || notifyErr);
      }
    }
  }

  return {
    messageId: message._id,
    conversationId: conversation._id,
    receiverId: receiverId || null,
    normalizedPhone: normalized.e164,
  };
};
