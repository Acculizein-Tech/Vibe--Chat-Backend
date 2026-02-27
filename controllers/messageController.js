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

    const directConversation = await Conversation.findById(conversationId)
      .select("isGroup")
      .lean();
    const groupConversation = directConversation
      ? null
      : await GroupConversation.findById(conversationId)
          .select("participants")
          .lean();

    const isGroupConversation = Boolean(groupConversation);
    const conversation = directConversation || groupConversation;
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

    if (isGroupConversation) {
      await GroupConversation.findByIdAndUpdate(conversationId, {
        lastMessage: message._id,
      });
    } else {
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: message._id,
      });
    }

    const outgoing = await materializeMessageForClient(message);
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
    const { text, userId } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Only sender can edit
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ error: "You can edit only your messages" });
    }

    const encrypted = await encryptMessageText({
      conversationId: message.conversationId,
      text,
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
    const { userId } = req.body;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // NEW AUTH LOGIC: Allow if user is in the conversation (not just sender)
    const conversation =
      (await Conversation.findById(message.conversationId)) ||
      (await GroupConversation.findById(message.conversationId));
    if (!conversation || !conversation.participants.includes(userId)) {
      return res.status(403).json({ error: "You can only delete messages in your conversations" });
    }

    // OLD LOGIC (optional: uncomment if you want to keep sender-only restriction as fallback)
    // if (message.sender.toString() !== userId) {
    //   return res.status(403).json({ error: "You can delete only your messages" });
    // }

    await Message.findByIdAndDelete(messageId);

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


//multiple imags
export const uploadChatImages = asyncHandler(async (req, res) => {
  const { conversationId, receiverId } = req.body;
  const files = req.files || [];

  if (!conversationId) {
    return res.status(400).json({
      success: false,
      message: "conversationId is required",
    });
  }

  if (!files.length) {
    return res.status(400).json({
      success: false,
      message: "No images received",
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

  uploadResults.forEach((result, index) => {
    if (result.status === "fulfilled" && result.value.success) {
      media.push({
        url: result.value.url,
        type: "image",
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

  // optional: update lastMessage
  conversation.lastMessage = message._id;
  await conversation.save();

  return res.json({
    success: true,
    message: "Images uploaded & message created",
    messageId: message._id,
    media,
    failed: failedFiles,
  });
});
