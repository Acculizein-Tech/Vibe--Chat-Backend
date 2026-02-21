import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import GroupConversation from "../models/GroupConversation.js";
import Notification from "../models/Notification.js";
import { sendPushNotification } from "./pushService.js";
import User from "../models/user.js";
import mongoose from "mongoose";
import {
  encryptMessageText,
  materializeMessageForClient,
  decryptMessageText,
} from "./messageCrypto.js";

import {
  onlineUsers,
  activeConversationViewers,
  userAppState,
} from "./socketState.js";

export const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("ðŸŸ¢ Socket connected:", socket.id);

    const resolveConversation = async (conversationId) => {
      if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
        return null;
      }

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

    const emitToUser = (userId, event, payload) => {
      const uid = String(userId || "");
      if (!uid) return;
      io.to(`user:${uid}`).emit(event, payload);
      const sid = onlineUsers.get(uid);
      if (sid) io.to(sid).emit(event, payload);
    };

    // Dedupe repeated conversationOpen acknowledgements from same socket/user.
    const lastReadResetEmitAt = new Map();
    const READ_RESET_DEDUPE_MS = 1200;

    const emitChatListPatch = async ({ conversationId, text, createdAt }) => {
      if (!conversationId) return;
      const conv = await resolveConversation(conversationId);
      if (!conv?.participants?.length) return;

      const payload = {
        conversationId,
        text: text ?? "",
        createdAt: createdAt || new Date().toISOString(),
      };

      conv.participants.forEach((uid) => {
        const sid = onlineUsers.get(uid.toString());
        if (sid) io.to(sid).emit("chat:list:patch", payload);
      });
    };
    /* ========================= 
       REGISTER USER 
    ========================== */
    socket.on("register", (userId) => {
      if (!userId) return;
      socket.userId = userId.toString();
      onlineUsers.set(socket.userId, socket.id);
      socket.join(`user:${socket.userId}`);
      console.log("âœ… User registered:", socket.userId);
    });

    /* ========================= 
       JOIN ROOM 
    ========================== */
    socket.on("joinRoom", ({ conversationId }) => {
      if (!conversationId) return;
      socket.join(conversationId.toString());
    });

    /* ========================= 
       CHAT OPEN / CLOSE 
    ========================== */
    socket.on("conversationOpen", async ({ conversationId, userId }) => {
      if (!conversationId || !userId) return;

      console.log("?? Chat open:", conversationId, userId);

      try {
        if (
          !mongoose.Types.ObjectId.isValid(conversationId) ||
          !mongoose.Types.ObjectId.isValid(userId)
        ) {
          return;
        }

        const conversation = await resolveConversation(conversationId);
        const isParticipant = !!conversation?.participants?.some(
          (p) => String(p) === String(userId),
        );
        if (!isParticipant) return;

        if (!activeConversationViewers.has(conversationId)) {
          activeConversationViewers.set(conversationId, new Set());
        }
        activeConversationViewers.get(conversationId).add(userId.toString());

        const conversationObjectId = new mongoose.Types.ObjectId(conversationId);
        const userObjectId = new mongoose.Types.ObjectId(userId);

        const targetNotifications = await Notification.find(
          {
            recipient: userObjectId,
            type: "NEW_MESSAGE",
            "data.conversationId": conversationObjectId,
            isRead: false,
          },
          { _id: 1 },
        ).lean();

        if (!targetNotifications.length) {
          return;
        }

        const readResult = await Notification.updateMany(
          {
            _id: { $in: targetNotifications.map((n) => n._id) },
          },
          { $set: { isRead: true } },
        );

        if (readResult.modifiedCount > 0) {
          const unreadCount = await Notification.countDocuments({
            recipient: userId,
            isRead: false,
          });
          const resetPayload = {
            conversationId: conversationId.toString(),
            unread: 0,
            unreadTotal: unreadCount,
            updatedAt: new Date().toISOString(),
          };
          const dedupeKey = `${socket.id}:${String(userId)}:${String(conversationId)}`;
          const nowTs = Date.now();
          const lastTs = lastReadResetEmitAt.get(dedupeKey) || 0;

          if (nowTs - lastTs >= READ_RESET_DEDUPE_MS) {
            lastReadResetEmitAt.set(dedupeKey, nowTs);
            emitToUser(userId, "conversationRead", resetPayload);
            emitToUser(userId, "chat:unread:reset", resetPayload);
            emitToUser(userId, "chat:list:patch", {
              conversationId: conversationId.toString(),
              unread: 0,
              createdAt: resetPayload.updatedAt,
            });
            emitToUser(userId, "unreadCount", unreadCount);
          }
        }
      } catch (err) {
        console.error("conversationOpen read-sync error:", err);
      }
    });

    socket.on("conversationClose", ({ conversationId, userId }) => {
      if (!conversationId || !userId) return;

      activeConversationViewers
        .get(conversationId)
        ?.delete(userId.toString());

      console.log("âŒ Chat closed:", conversationId, userId);
    });

    /* ========================= 
       APP STATE (INFO ONLY) 
    ========================== */
    socket.on("appState", (state) => {
      if (!socket.userId) return;
      userAppState.set(socket.userId, state);
      console.log("ðŸ“± AppState:", socket.userId, state);
    });

    /* ========================= 
       SEND MESSAGE (FIXED) 
    ========================== */
    socket.on("sendMessage", async (data) => {
      try {
        const { sender, receiver, text, conversationId, tempId } = data;
        if (!sender || !text || !conversationId) return;
        const conversation = await resolveConversation(conversationId);
        if (!conversation) return;
        const isGroupConversation = Boolean(conversation.isGroup);
        if (!isGroupConversation && !receiver) return;
        if (
          !isGroupConversation &&
          receiver &&
          sender.toString() === receiver.toString()
        ) return;
        const textValue = String(text || "");
        const cryptoCache = new Map();
        const encrypted = await encryptMessageText({
          conversationId,
          text: textValue,
          cache: cryptoCache,
        });

        /* 1ï¸âƒ£ SAVE MESSAGE */
        const msg = await Message.create({
          sender,
          receiver: isGroupConversation ? null : receiver,
          conversationId,
          ...encrypted,
        });

        await updateLastMessageRef({
          conversationId,
          source: conversation.source,
          messageId: msg._id,
        });

        /* 2ï¸âƒ£ REALTIME MESSAGE */
        const outgoingMsg = {
          ...(await materializeMessageForClient(msg, cryptoCache)),
          tempId: tempId || null,
        };
        io.to(conversationId.toString()).emit("messageReceived", outgoingMsg);








        /* ================================ 
           ðŸ”¥ NEW PART â€“ CHAT LIST UPDATE 
        ================================= */

        const chatListPayload = {
          conversationId,
          text: textValue,
          sender: sender,
          receiver: isGroupConversation ? null : receiver,
          createdAt: msg.createdAt,
        };
        const participantIds = (conversation.participants || []).map((p) =>
          p.toString(),
        );
        participantIds.forEach((uid) => {
          const sid = onlineUsers.get(uid);
          if (sid) io.to(sid).emit("chat:list:update", chatListPayload);
        });
        console.log("ðŸ’¬ Chat list update sent", chatListPayload);
        /* ================================ 
           â¬†ï¸ à¤¯à¤¹à¥€ MISSING THA 
     
     
            /* 3ï¸âƒ£ CHECK IF RECEIVER IS IN SAME CHAT */
        const viewers =
          activeConversationViewers.get(conversationId.toString()) ||
          new Set();

        const recipients = (conversation.participants || [])
          .map((p) => p.toString())
          .filter((uid) => uid && uid !== sender.toString());
        const senderUser = await User.findById(sender).select("fullName").lean();

        /* 4? CREATE DB NOTIFICATION (GROUP + DIRECT) */
        let deliveredNotifications = 0;
        for (const recipientId of recipients) {
          if (viewers.has(recipientId)) continue;

          const notification = await Notification.create({
            recipient: recipientId,
            scope: "USER",
            type: "NEW_MESSAGE",
            title: isGroupConversation ? "New Group Message" : "New Message",
            message:
              textValue.length > 40 ? textValue.slice(0, 40) + "..." : textValue,
            data: {
              conversationId,
              senderId: sender,
              isGroup: isGroupConversation,
            },
            isRead: false,
          });
          deliveredNotifications += 1;

          const recipientSocketId = onlineUsers.get(recipientId);
          if (recipientSocketId) {
            io.to(recipientSocketId).emit("newNotification", notification);
            const unreadCount = await Notification.countDocuments({
              recipient: recipientId,
              isRead: false,
            });
            io.to(recipientSocketId).emit("unreadCount", unreadCount);
          }

          const recipientUser = await User.findById(recipientId)
            .select("pushToken")
            .lean();
          if (recipientUser?.pushToken) {
            await sendPushNotification({
              pushToken: recipientUser.pushToken,
              title: `${senderUser?.fullName || "Ryngales"} • Ryngales`,
              body:
                textValue.length > 40 ? textValue.slice(0, 40) + "..." : textValue,
              data: {
                type: "CHAT_MESSAGE",
                conversationId,
                senderId: sender,
                isGroup: isGroupConversation,
              },
            });
          }
        }
        if (!deliveredNotifications) {
          console.log("Same chat open -> no notification / no push");
        }
      } catch (err) {
        console.error("âŒ sendMessage error:", err);
      }
    });

    /* =========================
       âœï¸ EDIT MESSAGE (SOCKET REALTIME)
    ========================== */
    socket.on("editMessage", async (data) => {
      try {
        const { sender, messageId, conversationId, text } = data || {};
        if (!sender || !messageId || !conversationId || !text?.trim()) {
          return socket.emit("edit:error", { message: "Invalid edit payload" });
        }
        const textValue = text.trim();
        const encrypted = await encryptMessageText({
          conversationId,
          text: textValue,
        });

        const updated = await Message.findOneAndUpdate(
          {
            _id: messageId,
            conversationId,
            sender,
          },
          { $set: encrypted },
          { new: true },
        );

        if (!updated) {
          return socket.emit("edit:error", {
            message: "Message not found or not editable",
          });
        }

        io.to(conversationId.toString()).emit("messageEdited", {
          messageId: updated._id,
          conversationId,
          text: textValue,
          updatedAt: updated.updatedAt,
        });

        const convo = await resolveConversation(conversationId);
        const isLatestMessage =
          convo?.lastMessage &&
          String(convo.lastMessage) === String(updated._id);
        if (isLatestMessage) {
          await emitChatListPatch({
            conversationId,
            text: textValue,
            createdAt: updated.updatedAt,
          });
        }

        socket.emit("edit:success", {
          messageId: updated._id,
          conversationId,
        });
      } catch (err) {
        console.error("editMessage error:", err);
        socket.emit("edit:error", { message: "Failed to edit message" });
      }
    });

    /* =========================
   ðŸ” FORWARD MESSAGE (PRODUCTION)
========================= */


   socket.on("forwardMessage", async (data) => {
  try {
    const { sender, messageId, text, messageIds = [], targetConversationIds = [] } = data;

    /* ============================================================
       ðŸ“¥ COLLECT ORIGINALS (The "Baap" Fix)
    ============================================================ */
    let originals = [];

    // 1. Array banao saari IDs ka jo frontend se aayi hain
    const incomingIds = [...messageIds, messageId].filter(Boolean);
    console.log(`ðŸ” [FORWARD] Incoming IDs: ${incomingIds.join(", ")}`);

    // 2. ðŸ”¥ Sabse Zaroori: Sirf wahi IDs filter karo jo asli 24-char Hex hain
    // Isse 'temp-...' waali IDs query tak pahunchengi hi nahi, toh CastError nahi aayega
    const validMongoIds = incomingIds.filter(id => 
      id && typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)
    );
    
    const tempIds = incomingIds.filter(id => 
      id && typeof id === 'string' && id.startsWith("temp-")
    );
    
    if (tempIds.length > 0) {
      console.warn(`âš ï¸ [FORWARD] Filtering out tempIds (not yet synced): ${tempIds.join(", ")}`);
    }
    console.log(`âœ… [FORWARD] Valid Mongo IDs: ${validMongoIds.join(", ")}`);

    // 3. Agar valid IDs mili, tabhi DB query karo
    if (validMongoIds.length > 0) {
      originals = await Message.find({ _id: { $in: validMongoIds } }).lean();
      console.log(`âœ… [FORWARD] Found ${originals.length} messages in DB`);
    }

    // 4. ðŸ”¥ Race Condition Fallback (Fresh Message Case)
    // Agar DB mein kuch nahi mila (kyunki IDs temp thin) toh text fallback use karo
    if (originals.length === 0 && text) {
      console.log("âš ï¸ [FORWARD] DB sync pending (temp-id case), using fallback text");
      originals = [{ text: text, sender: sender }]; 
    }

    if (originals.length === 0) {
      console.error("âŒ [FORWARD] No messages found and no fallback text provided");
      return socket.emit("forward:error", { message: "Nothing to forward" });
    }

    /* =========================
       ðŸ” BUILD + INSERT
    ========================== */
    const messagesToInsert = [];
    const targetMetaMap = new Map();

    for (const conversationId of targetConversationIds) {
      // Conversation ID check
      if (!conversationId || !/^[0-9a-fA-F]{24}$/.test(conversationId)) continue;

      const conv = await resolveConversation(conversationId);
      if (!conv) continue;
      targetMetaMap.set(String(conversationId), conv);

      let receiver = null;
      if (!conv.isGroup && conv.participants) {
        receiver = conv.participants.find(p => p.toString() !== sender.toString()) || null;
      }

      for (const original of originals) {
        const originalText = await decryptMessageText(original);
        const encrypted = await encryptMessageText({
          conversationId,
          text: originalText || "",
        });
        messagesToInsert.push({
          conversationId: conversationId,
          sender: sender,
          receiver: receiver,
          ...encrypted,
          forwarded: true,
          forwardedFrom: (original.sender && /^[0-9a-fA-F]{24}$/.test(original.sender)) 
                         ? original.sender 
                         : sender,
          status: "sent"
        });
      }
    }

    const savedMessages = await Message.insertMany(messagesToInsert);

    /* =========================
       ðŸ“¡ EMITS
    ========================== */
    for (const msg of savedMessages) {
      const outgoingMsg = await materializeMessageForClient(msg);
      const previewText = String(outgoingMsg?.text || "");
      io.to(msg.conversationId.toString()).emit("messageReceived", outgoingMsg);
      const convMeta = targetMetaMap.get(String(msg.conversationId));
      await updateLastMessageRef({
        conversationId: msg.conversationId,
        source: convMeta?.source || "direct",
        messageId: msg._id,
      });

      const chatListPayload = {
        conversationId: msg.conversationId,
        text: previewText,
        sender: msg.sender,
        receiver: msg.receiver,
        createdAt: msg.createdAt,
      };

      const participantIds = (convMeta?.participants || [msg.sender, msg.receiver])
        .filter(Boolean)
        .map((p) => p.toString());
      participantIds.forEach((uid) => {
        const sid = onlineUsers.get(uid);
        if (sid) io.to(sid).emit("chat:list:update", chatListPayload);
      });
    }

    socket.emit("forward:success", { count: savedMessages.length });

  } catch (err) {
    console.error("ðŸ”¥ CRITICAL ERROR:", err);
    socket.emit("forward:error", { message: "Internal server error" });
  }
   });


    /* =========================
       ðŸ—‘ï¸ DELETE MESSAGE(S)
    ========================== */
    socket.on("deleteMessage", async (data) => {
      try {
        const {
          sender,
          messageId,
          messageIds = [],
          conversationId,
          deleteFor = "everyone",
        } = data;

        console.log("Delete request:", data);

        if (!sender || !conversationId) {
          return socket.emit("delete:error", {
            message: "Invalid delete payload",
          });
        }

        const conversation = await resolveConversation(conversationId);
        const isParticipant = !!conversation?.participants?.some(
          (p) => p.toString() === sender.toString(),
        );

        if (!isParticipant) {
          return socket.emit("delete:error", {
            message: "You are not part of this conversation",
          });
        }

        const idsToDelete = [];
        if (messageIds.length) {
          idsToDelete.push(...messageIds);
        } else if (messageId) {
          idsToDelete.push(messageId);
        }

        const validIds = idsToDelete.filter((id) =>
          mongoose.Types.ObjectId.isValid(id),
        );

        if (!validIds.length) {
          return socket.emit("delete:error", {
            message: "No messages selected",
          });
        }

        if (deleteFor === "everyone") {
          // Sender can delete-for-everyone only their own messages.
          const ownMessageIds = (
            await Message.find(
              {
                _id: { $in: validIds },
                conversationId,
                sender,
              },
              { _id: 1 },
            ).lean()
          ).map((m) => m._id);

          if (!ownMessageIds.length) {
            return socket.emit("delete:error", {
              message: "No sender-owned messages found for delete for everyone",
            });
          }

          const result = await Message.updateMany(
            {
              _id: { $in: ownMessageIds },
            },
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

          io.to(conversationId.toString()).emit("messageDeleted", {
            messageIds: ownMessageIds,
            conversationId,
            deleteFor: "everyone",
            replacementText: "This message was deleted",
          });

          const latestMessageId = conversation?.lastMessage
            ? String(conversation.lastMessage)
            : null;
          const latestDeleted = latestMessageId
            ? ownMessageIds.some((id) => String(id) === latestMessageId)
            : false;
          if (latestDeleted) {
            await emitChatListPatch({
              conversationId,
              text: "This message was deleted",
              createdAt: new Date().toISOString(),
            });
          }

          socket.emit("delete:success", {
            deletedCount: result.modifiedCount,
            deleteFor: "everyone",
          });

          console.log(
            `Delete for everyone applied to ${result.modifiedCount} messages`,
          );
          return;
        }

        const hidden = await Message.updateMany(
          {
            _id: { $in: validIds },
            conversationId,
          },
          {
            $addToSet: { deletedFor: sender },
          },
        );

        socket.emit("messageDeleted", {
          messageIds: validIds,
          conversationId,
          deleteFor: "me",
        });

        socket.emit("delete:success", {
          deletedCount: hidden.modifiedCount || 0,
          deleteFor: "me",
        });

        console.log(
          `Hidden ${hidden.modifiedCount || 0} messages for user ${sender}`,
        );
      } catch (err) {
        console.error("deleteMessage error:", err);

        socket.emit("delete:error", {
          message: "Failed to delete messages",
        });
      }
    });



    /* ========================= 
       DISCONNECT 
    ========================== */
    socket.on("disconnect", () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        userAppState.delete(socket.userId);
        console.log("ðŸ”´ User disconnected:", socket.userId);
      }
    });
  });
};



