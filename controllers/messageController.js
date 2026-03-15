import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import GroupConversation from "../models/GroupConversation.js";
import { io } from "../index.js";
import Notification from "../models/Notification.js";
import {
  onlineUsers,
  activeConversationViewers,
} from "../utils/socketState.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadToS3 } from "../middlewares/upload.js";
import {
  encryptMessageText,
  materializeMessageForClient,
} from "../utils/messageCrypto.js";
import User from "../models/user.js";
import { sendPushNotification } from "../utils/pushService.js";

const normalizeId = (value) => String(value || "").trim();
const uniqueIds = (values = []) =>
  Array.from(new Set(values.map((v) => normalizeId(v)).filter(Boolean)));

const resolveConversationForMessage = async (conversationId) => {
  const direct = await Conversation.findById(conversationId)
    .select("participants isGroup lastMessage")
    .lean();
  if (direct) {
    return { ...direct, source: "direct", isGroup: Boolean(direct.isGroup) };
  }
  const group = await GroupConversation.findById(conversationId)
    .select("participants groupName lastMessage")
    .lean();
  if (group) {
    return { ...group, source: "group", isGroup: true };
  }
  return null;
};

const updateLastMessageRef = async ({ conversationId, source, messageId }) => {
  if (!conversationId || !source || !messageId) return;
  if (source === "group") {
    await GroupConversation.findByIdAndUpdate(conversationId, {
      lastMessage: messageId,
    });
    return;
  }
  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: messageId,
  });
};

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

const buildMediaPreviewText = (media = []) => {
  const firstType = normalizeId(media?.[0]?.type);
  if (!firstType) return "";
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

const truncatePreview = (value, max = 80) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}...`;
};

const emitMessageSideEffects = async ({
  conversationId,
  conversation,
  senderId,
  receiverIds = [],
  outgoing,
  previewLabel,
  createdAt,
}) => {
  const cid = normalizeId(conversationId);
  const sender = normalizeId(senderId);
  if (!cid || !sender || !conversation || !outgoing) return;

  const participantIds = uniqueIds(conversation?.participants || []);
  const recipients = uniqueIds(receiverIds).filter((id) => id !== sender);
  const isGroupConversation = Boolean(conversation?.isGroup);

  io.to(cid).emit("messageReceived", outgoing);
  participantIds.forEach((uid) => {
    emitToUser(uid, "messageReceived", outgoing);
  });

  const chatListPayload = {
    conversationId: cid,
    text: String(previewLabel || ""),
    forwarded: Boolean(outgoing?.forwarded),
    previewKind: buildMediaPreviewKind(outgoing?.media),
    media: Array.isArray(outgoing?.media) ? outgoing.media : [],
    sender,
    receiver: isGroupConversation ? recipients : recipients[0] || null,
    createdAt: createdAt || new Date().toISOString(),
  };
  participantIds.forEach((uid) => {
    emitToUser(uid, "chat:list:update", chatListPayload);
  });

  const viewers = activeConversationViewers.get(cid) || new Set();
  const [senderUser, recipientUsers] = await Promise.all([
    User.findById(sender).select("fullName username phone").lean(),
    recipients.length
      ? User.find({ _id: { $in: recipients } }).select("_id pushToken").lean()
      : [],
  ]);
  const recipientPushMap = new Map(
    (recipientUsers || []).map((u) => [normalizeId(u?._id), String(u?.pushToken || "").trim()]),
  );

  const senderLabel =
    String(
      senderUser?.fullName ||
        senderUser?.username ||
        senderUser?.phone ||
        "Ryngales",
    ).trim() || "Ryngales";
  const groupLabel = String(conversation?.groupName || "").trim() || "Group";
  const previewText = truncatePreview(previewLabel, 80);
  const chatThreadKey = `chat:${cid}`;

  for (const recipientId of recipients) {
    if (!recipientId || viewers.has(recipientId)) continue;
    try {
      const notification = await Notification.create({
        recipient: recipientId,
        scope: "USER",
        type: "NEW_MESSAGE",
        title: isGroupConversation ? groupLabel : "New Message",
        message: isGroupConversation
          ? `${senderLabel}: ${previewText || "New message"}`
          : previewText || "New message",
        data: {
          conversationId: cid,
          senderId: sender,
          isGroup: isGroupConversation,
          groupName: isGroupConversation ? groupLabel : "",
          senderLabel,
          threadKey: chatThreadKey,
        },
        isRead: false,
      });

      emitToUser(recipientId, "newNotification", notification);
      const unreadCount = await Notification.countDocuments({
        recipient: recipientId,
        isRead: false,
      });
      emitToUser(recipientId, "unreadCount", unreadCount);

      const pushToken = recipientPushMap.get(recipientId);
      if (pushToken) {
        await sendPushNotification({
          pushToken,
          title: isGroupConversation ? groupLabel : `${senderLabel} • Ryngales`,
          body: isGroupConversation
            ? `${senderLabel}: ${previewText || "New message"}`
            : previewText || "New message",
          subtitle: isGroupConversation ? senderLabel : undefined,
          threadKey: chatThreadKey,
          data: {
            type: "CHAT_MESSAGE",
            conversationId: cid,
            senderId: sender,
            isGroup: isGroupConversation,
            groupName: isGroupConversation ? groupLabel : "",
            senderLabel,
            threadKey: chatThreadKey,
          },
        });
      }
    } catch (notificationErr) {
      console.error("message side-effect notification error:", notificationErr);
    }
  }
};


// ✅ Send a message
// ✅ Secure version — sender from token
// export const sendMessage = async (req, res) => {
//   try {
//     const sender = req.user.id || req.user._id; // from token
//     const { conversationId, receiver, text } = req.body;

//     if (!conversationId || !receiver || !text) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     const message = await Message.create({
//       conversationId,
//       sender,
//       receiver,
//       text,
//     });

//     await Conversation.findByIdAndUpdate(conversationId, {
//       lastMessage: message._id,
//     });

//     res.status(201).json(message);
//   } catch (error) {
//     console.error("❌ sendMessage error:", error);
//     res.status(500).json({ error: error.message });
//   }
// };

// export const sendMessage = async (req, res) => {
//   try {
//     const sender = req.user.id || req.user._id;
//     const { conversationId, receiver, text } = req.body;

//     if (!conversationId || !receiver || !text) {
//       return res.status(400).json({ error: "Missing required fields" });
//     }

//     // 1️⃣ Save message
//     const message = await Message.create({
//       conversationId,
//       sender,
//       receiver,
//       text,
//     });

//     // 2️⃣ Update latest message in conversation
//     await Conversation.findByIdAndUpdate(conversationId, {
//       lastMessage: message._id,
//     });

//     res.status(201).json(message);

//     // 3️⃣ Emit real-time event to room
//     io.to(conversationId).emit("messageReceived", message);

//   } catch (error) {
//     console.error("❌ sendMessage error:", error);
//     res.status(500).json({ error: error.message });
//   }
// };
// export const sendMessage = async (req, res) => {
//   try {
//     const sender = req.user._id;
//     const { conversationId, receiver, text } = req.body;

//     if (!conversationId || !receiver || !text) {
//       return res.status(400).json({ error: "Missing fields" });
//     }

//     const message = await Message.create({
//       conversationId,
//       sender,
//       receiver,
//       text,
//     });

//     await Conversation.findByIdAndUpdate(conversationId, {
//       lastMessage: message._id,
//     });

//     // 📡 Send message
//     io.to(conversationId.toString()).emit("messageReceived", message);

//     // 🧠 CHECK VIEWERS
//     const viewers =
//       activeConversationViewers.get(conversationId.toString()) || new Set();

//     const receiverIsViewing = viewers.has(receiver.toString());

//     console.log("🧠 Viewers:", viewers, "Receiver:", receiver);

//     if (!receiverIsViewing) {
//       const notification = await Notification.create({
//         recipient: receiver,
//         scope: "USER",
//         type: "NEW_MESSAGE",
//         title: "New Message",
//         message: text.length > 30 ? text.slice(0, 30) + "..." : text,
//         data: { conversationId, senderId: sender },
//         isRead: false,
//       });

//       const receiverSocketId = onlineUsers.get(receiver.toString());
//       if (receiverSocketId) {
//         io.to(receiverSocketId).emit(
//           "newNotification",
//           notification.toObject()
//         );
//       }

//       console.log("🔔 Notification sent to", receiver);
//     }

//     res.status(201).json(message);
//   } catch (err) {
//     console.error("❌ sendMessage:", err);
//     res.status(500).json({ error: err.message });
//   }
// };
// controllers/messageController.js
export const sendMessage = async (req, res) => {
  try {
    const sender = req.user._id;
    const { conversationId, receiver, text } = req.body;

    if (!conversationId || !text) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const conversation = await resolveConversationForMessage(conversationId);
    const isGroupConversation = Boolean(conversation?.isGroup);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    if (!isGroupConversation && !receiver) {
      return res.status(400).json({ error: "Receiver is required for direct chat" });
    }

    const encrypted = await encryptMessageText({
      conversationId,
      text,
    });
    const groupReceiverIds = isGroupConversation
      ? (conversation?.participants || [])
          .map((id) => String(id || ""))
          .filter((id) => id && id !== String(sender))
      : null;

    const message = await Message.create({
      conversationId,
      sender,
      receiver: isGroupConversation ? groupReceiverIds : receiver,
      deliveryInfo: [],
      readBy: [sender],
      readInfo: [{ userId: sender, readAt: new Date() }],
      ...encrypted,
    });

    await updateLastMessageRef({
      conversationId,
      source: conversation.source,
      messageId: message._id,
    });

    const outgoing = await materializeMessageForClient(message);
    const previewLabel = String(text || "").trim();
    await emitMessageSideEffects({
      conversationId,
      conversation,
      senderId: sender,
      receiverIds: isGroupConversation ? groupReceiverIds : [receiver],
      outgoing,
      previewLabel,
      createdAt: message.createdAt,
    });
    res.status(201).json(outgoing);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



// ✅ Fetch all messages in a conversation
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?._id;
    const query = { conversationId };

    if (userId) {
      query.deletedFor = { $nin: [userId] };
    }

    const messages = await Message.find(query).sort({
      createdAt: 1,
    });
    const cache = new Map();
    const outgoing = await Promise.all(
      messages.map((msg) => materializeMessageForClient(msg, cache)),
    );
    res.json(outgoing);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// ✅ Edit a message
export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    const requesterId = normalizeId(req.user?._id || req.user?.id);
    const nextText = String(text || "").trim();

    if (!requesterId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!nextText) {
      return res.status(400).json({ error: "Text is required" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Only sender can edit
    if (normalizeId(message.sender) !== requesterId) {
      return res.status(403).json({ error: "You can edit only your messages" });
    }

    const encrypted = await encryptMessageText({
      conversationId: message.conversationId,
      text: nextText,
    });

    message.text = encrypted.text;
    message.encryptedText = encrypted.encryptedText;
    message.textIv = encrypted.textIv;
    message.textAuthTag = encrypted.textAuthTag;
    message.textAlg = encrypted.textAlg;
    message.encryptionVersion = encrypted.encryptionVersion;
    message.isEncrypted = encrypted.isEncrypted;
    message.isEdited = true;
    await message.save();

    const outgoing = await materializeMessageForClient(message);
    res.status(200).json({ message: "Message updated successfully", data: outgoing });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ✅ Delete a message
// export const deleteMessage = async (req, res) => {
//   try {
//     const { messageId } = req.params;
//     const { userId } = req.body;

//     const message = await Message.findById(messageId);
//     if (!message) {
//       return res.status(404).json({ error: "Message not found" });
//     }

//     // Only sender can delete
//     if (message.sender.toString() !== userId) {
//       return res.status(403).json({ error: "You can delete only your messages" });
//     }

//     await Message.findByIdAndDelete(messageId);

//     res.status(200).json({ message: "Message deleted successfully" });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };

// ✅ Delete a message (Updated)
export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteFor = "everyone" } = req.body || {};
    const requesterId = normalizeId(req.user?._id || req.user?.id);

    if (!requesterId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // NEW AUTH LOGIC: Allow if user is in the conversation (not just sender)
    const conversation = await resolveConversationForMessage(message.conversationId);
    const isParticipant = Boolean(
      conversation?.participants?.some((p) => normalizeId(p) === requesterId),
    );
    if (!conversation || !isParticipant) {
      return res.status(403).json({ error: "You can only delete messages in your conversations" });
    }

    if (String(deleteFor) === "me") {
      await Message.updateOne(
        { _id: messageId, conversationId: message.conversationId },
        { $addToSet: { deletedFor: requesterId } },
      );
      emitToUser(requesterId, "messageDeleted", {
        messageIds: [messageId],
        conversationId: String(message.conversationId),
        deleteFor: "me",
      });
      return res.status(200).json({
        message: "Message deleted for me",
        deleteFor: "me",
        messageIds: [messageId],
      });
    }

    if (normalizeId(message.sender) !== requesterId) {
      return res
        .status(403)
        .json({ error: "You can delete for everyone only your messages" });
    }

    await Message.updateOne(
      { _id: messageId, conversationId: message.conversationId },
      {
        $set: {
          text: "This message was deleted",
          encryptedText: "",
          textIv: "",
          textAuthTag: "",
          isEncrypted: false,
          media: [],
        },
      },
    );

    io.to(String(message.conversationId)).emit("messageDeleted", {
      messageIds: [messageId],
      conversationId: String(message.conversationId),
      deleteFor: "everyone",
      replacementText: "This message was deleted",
    });
    res.status(200).json({
      message: "Message deleted for everyone",
      deleteFor: "everyone",
      messageIds: [messageId],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


//multiple imags
export const uploadChatImages = asyncHandler(async (req, res) => {
  const { conversationId, receiverId, tempId } = req.body;
  const files = req.files || [];
  const parsePositiveNumber = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    return Math.round(num);
  };
  let attachmentMetaByIndex = [];
  try {
    const rawMeta = req.body?.attachmentMeta;
    const parsed = typeof rawMeta === "string" ? JSON.parse(rawMeta) : rawMeta;
    if (Array.isArray(parsed)) {
      attachmentMetaByIndex = parsed.map((item) => ({
        fileName: String(item?.name || item?.fileName || "").trim(),
        mimeType: String(item?.mimeType || item?.mimetype || "").trim(),
        sizeBytes:
          parsePositiveNumber(
            item?.sizeBytes ?? item?.size ?? item?.fileSize ?? item?.bytes,
          ) || null,
        pageCount:
          parsePositiveNumber(
            item?.pageCount ?? item?.pages ?? item?.totalPages ?? item?.page_count,
          ) || null,
      }));
    }
  } catch (_metaErr) {
    attachmentMetaByIndex = [];
  }

  if (!conversationId) {
    return res.status(400).json({
      success: false,
      message: "conversationId is required",
    });
  }

  if (!files.length) {
    return res.status(400).json({
      success: false,
      message: "No attachments received",
    });
  }

  // 🔐 Validate conversation access
  const conversation =
    (await Conversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    })) ||
    (await GroupConversation.findOne({
      _id: conversationId,
      participants: req.user._id,
    }));

  if (!conversation) {
    return res.status(403).json({
      success: false,
      message: "Not allowed to upload to this conversation",
    });
  }
  const isGroupConversationForUpload =
    conversation?.constructor?.modelName === "GroupConversation";

  // 🔥 Parallel S3 uploads
  const uploadResults = await Promise.allSettled(
    files.map((file) => uploadToS3(file, req))
  );

  const media = [];
  const failedFiles = [];

  const getMediaType = (mimetype = "") => {
    const mime = String(mimetype || "").toLowerCase();
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    return "file";
  };

  uploadResults.forEach((result, index) => {
    const meta = attachmentMetaByIndex[index] || {};
    if (result.status === "fulfilled" && result.value.success) {
      const uploadPageCount =
        parsePositiveNumber(result?.value?.pageCount) || null;
      const metaPageCount =
        parsePositiveNumber(meta.pageCount) || null;
      media.push({
        url: result.value.url,
        type: getMediaType(files[index]?.mimetype),
        thumbnailUrl: String(result?.value?.thumbnailUrl || "").trim(),
        fileName:
          meta.fileName ||
          files[index]?.originalname ||
          "",
        mimeType: meta.mimeType || files[index]?.mimetype || "",
        sizeBytes:
          meta.sizeBytes != null
            ? meta.sizeBytes
            : parsePositiveNumber(files[index]?.size),
        pageCount:
          uploadPageCount != null
            ? uploadPageCount
            : metaPageCount != null
              ? metaPageCount
              : null,
      });
    } else {
      failedFiles.push({
        fileName: files[index].originalname,
        reason: result.reason?.message || "Upload failed",
      });
    }
  });

  if (!media.length) {
    return res.status(500).json({
      success: false,
      message: "All uploads failed",
      failed: failedFiles,
    });
  }

  // 🟢 Create message with media
  const message = await Message.create({
    conversationId,
    sender: req.user._id,
    receiver: isGroupConversationForUpload
      ? (conversation.participants || [])
          .map((id) => String(id || ""))
          .filter((id) => id && id !== String(req.user._id))
      : receiverId || null,
    deliveryInfo: [],
    readBy: [req.user._id],
    readInfo: [{ userId: req.user._id, readAt: new Date() }],
    text: "",
    media,
    status: "sent",
  });

  const resolvedConversation = await resolveConversationForMessage(conversationId);
  if (resolvedConversation?.source) {
    await updateLastMessageRef({
      conversationId,
      source: resolvedConversation.source,
      messageId: message._id,
    });
  } else {
    conversation.lastMessage = message._id;
    await conversation.save();
  }

  const outgoing = {
    ...(await materializeMessageForClient(message)),
    tempId: String(tempId || "").trim() || null,
  };
  const mediaPreviewText = buildMediaPreviewText(media);
  await emitMessageSideEffects({
    conversationId,
    conversation: resolvedConversation || {
      participants: conversation?.participants || [],
      isGroup: isGroupConversationForUpload,
      groupName: conversation?.groupName || "",
    },
    senderId: req.user._id,
    receiverIds: isGroupConversationForUpload
      ? (conversation.participants || [])
          .map((id) => String(id || ""))
          .filter((id) => id && id !== String(req.user._id))
      : [receiverId].filter(Boolean).length
        ? [receiverId]
        : (conversation.participants || [])
            .map((id) => String(id || ""))
            .filter((id) => id && id !== String(req.user._id)),
    outgoing,
    previewLabel: mediaPreviewText,
    createdAt: message.createdAt,
  });

  return res.json({
    success: true,
    message: "Attachments uploaded & message created",
    messageId: message._id,
    outgoing,
    media,
    failed: failedFiles,
  });
});
