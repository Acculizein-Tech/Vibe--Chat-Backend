import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Notification from "../models/Notification.js";
import { sendPushNotification } from "./pushService.js";
import User from "../models/user.js";

import {
  onlineUsers,
  activeConversationViewers,
  userAppState,
} from "./socketState.js";

export const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.id);

    /* ========================= 
       REGISTER USER 
    ========================== */
    socket.on("register", (userId) => {
      if (!userId) return;
      socket.userId = userId.toString();
      onlineUsers.set(socket.userId, socket.id);
      console.log("✅ User registered:", socket.userId);
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
    socket.on("conversationOpen", ({ conversationId, userId }) => {
      if (!conversationId || !userId) return;

      if (!activeConversationViewers.has(conversationId)) {
        activeConversationViewers.set(conversationId, new Set());
      }

      activeConversationViewers
        .get(conversationId)
        .add(userId.toString());

      console.log("👀 Chat open:", conversationId, userId);
    });

    socket.on("conversationClose", ({ conversationId, userId }) => {
      if (!conversationId || !userId) return;

      activeConversationViewers
        .get(conversationId)
        ?.delete(userId.toString());

      console.log("❌ Chat closed:", conversationId, userId);
    });

    /* ========================= 
       APP STATE (INFO ONLY) 
    ========================== */
    socket.on("appState", (state) => {
      if (!socket.userId) return;
      userAppState.set(socket.userId, state);
      console.log("📱 AppState:", socket.userId, state);
    });

    /* ========================= 
       SEND MESSAGE (FIXED) 
    ========================== */
    socket.on("sendMessage", async (data) => {
      try {
        const { sender, receiver, text, conversationId } = data;
        if (!sender || !receiver || !text || !conversationId) return;
        if (sender.toString() === receiver.toString()) return;

        /* 1️⃣ SAVE MESSAGE */
        const msg = await Message.create({
          sender,
          receiver,
          text,
          conversationId,
        });

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: msg._id,
        });

        /* 2️⃣ REALTIME MESSAGE */
        socket
          .to(conversationId.toString())
          .emit("messageReceived", msg);








        /* ================================ 
           🔥 NEW PART – CHAT LIST UPDATE 
        ================================= */

        const chatListPayload = {
          conversationId,
          text: msg.text,
          sender: sender,
          receiver: receiver,
          createdAt: msg.createdAt,
        };
        const senderSocketId = onlineUsers.get(sender.toString());
        const receiverSocketId = onlineUsers.get(receiver.toString());

        // sender chat list update 
        if (senderSocketId) {
          io.to(senderSocketId).emit("chat:list:update", chatListPayload);
        }

        // receiver chat list update 
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("chat:list:update", chatListPayload);
        }
        console.log("💬 Chat list update sent", chatListPayload);
        /* ================================ 
           ⬆️ यही MISSING THA 
     
     
            /* 3️⃣ CHECK IF RECEIVER IS IN SAME CHAT */
        const viewers =
          activeConversationViewers.get(conversationId.toString()) ||
          new Set();

        const receiverInChat = viewers.has(receiver.toString());

        /* 4️⃣ CREATE DB NOTIFICATION (ALWAYS IF NOT IN CHAT) */
        if (!receiverInChat) {
          const notification = await Notification.create({
            recipient: receiver,
            scope: "USER",
            type: "NEW_MESSAGE",
            title: "New Message",
            message: text.length > 40 ? text.slice(0, 40) + "…" : text,
            data: { conversationId, senderId: sender },
            isRead: false,
          });

          /* 5️⃣ REALTIME COUNTER (DO NOT TOUCH) */
          const receiverSocketId = onlineUsers.get(receiver.toString());

          if (receiverSocketId) {
            io.to(receiverSocketId).emit("newNotification", notification);

            const unreadCount = await Notification.countDocuments({
              recipient: receiver,
              isRead: false,
            });

            io.to(receiverSocketId).emit("unreadCount", unreadCount);
            console.log("🔢 Unread count:", unreadCount);
          }

          /* 6️⃣ PUSH NOTIFICATION (🔥 GUARANTEED 🔥) */
          const receiverUser = await User.findById(receiver).select("pushToken");
          const senderUser = await User.findById(sender).select("fullName");

          if (receiverUser?.pushToken) {
            await sendPushNotification({
              pushToken: receiverUser.pushToken,
              title: `${senderUser.fullName} • Ryngales`,
              body: text.length > 40 ? text.slice(0, 40) + "…" : text,
              data: {
                type: "CHAT_MESSAGE",
                conversationId,
                senderId: sender,
              },
            });

            console.log(
              "📲 Push sent | socket:",
              !!onlineUsers.get(receiver.toString()),
              "| appState:",
              userAppState.get(receiver.toString())
            );
          }
        } else {
          console.log("🚫 Same chat open → no notification / no push");
        }
      } catch (err) {
        console.error("❌ sendMessage error:", err);
      }
    });

    /* =========================
   🔁 FORWARD MESSAGE (PRODUCTION)
========================= */


   socket.on("forwardMessage", async (data) => {
  try {
    const { sender, messageId, text, messageIds = [], targetConversationIds = [] } = data;

    /* ============================================================
       📥 COLLECT ORIGINALS (The "Baap" Fix)
    ============================================================ */
    let originals = [];

    // 1. Array banao saari IDs ka jo frontend se aayi hain
    const incomingIds = [...messageIds, messageId].filter(Boolean);
    console.log(`🔁 [FORWARD] Incoming IDs: ${incomingIds.join(", ")}`);

    // 2. 🔥 Sabse Zaroori: Sirf wahi IDs filter karo jo asli 24-char Hex hain
    // Isse 'temp-...' waali IDs query tak pahunchengi hi nahi, toh CastError nahi aayega
    const validMongoIds = incomingIds.filter(id => 
      id && typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)
    );
    
    const tempIds = incomingIds.filter(id => 
      id && typeof id === 'string' && id.startsWith("temp-")
    );
    
    if (tempIds.length > 0) {
      console.warn(`⚠️ [FORWARD] Filtering out tempIds (not yet synced): ${tempIds.join(", ")}`);
    }
    console.log(`✅ [FORWARD] Valid Mongo IDs: ${validMongoIds.join(", ")}`);

    // 3. Agar valid IDs mili, tabhi DB query karo
    if (validMongoIds.length > 0) {
      originals = await Message.find({ _id: { $in: validMongoIds } }).lean();
      console.log(`✅ [FORWARD] Found ${originals.length} messages in DB`);
    }

    // 4. 🔥 Race Condition Fallback (Fresh Message Case)
    // Agar DB mein kuch nahi mila (kyunki IDs temp thin) toh text fallback use karo
    if (originals.length === 0 && text) {
      console.log("⚠️ [FORWARD] DB sync pending (temp-id case), using fallback text");
      originals = [{ text: text, sender: sender }]; 
    }

    if (originals.length === 0) {
      console.error("❌ [FORWARD] No messages found and no fallback text provided");
      return socket.emit("forward:error", { message: "Nothing to forward" });
    }

    /* =========================
       🔁 BUILD + INSERT
    ========================== */
    const messagesToInsert = [];

    for (const conversationId of targetConversationIds) {
      // Conversation ID check
      if (!conversationId || !/^[0-9a-fA-F]{24}$/.test(conversationId)) continue;

      const conv = await Conversation.findById(conversationId).select("participants isGroup").lean();
      if (!conv) continue;

      let receiver = null;
      if (!conv.isGroup && conv.participants) {
        receiver = conv.participants.find(p => p.toString() !== sender.toString()) || null;
      }

      for (const original of originals) {
        messagesToInsert.push({
          conversationId: conversationId,
          sender: sender,
          receiver: receiver,
          text: original.text || "",
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
       📡 EMITS
    ========================== */
    for (const msg of savedMessages) {
      io.to(msg.conversationId.toString()).emit("messageReceived", msg);
      await Conversation.findByIdAndUpdate(msg.conversationId, { lastMessage: msg._id });

      const chatListPayload = {
        conversationId: msg.conversationId,
        text: msg.text,
        sender: msg.sender,
        receiver: msg.receiver,
        createdAt: msg.createdAt,
      };

      [msg.sender, msg.receiver].forEach(uid => {
        if (uid) {
          const sid = onlineUsers.get(uid.toString());
          if (sid) io.to(sid).emit("chat:list:update", chatListPayload);
        }
      });
    }

    socket.emit("forward:success", { count: savedMessages.length });

  } catch (err) {
    console.error("🔥 CRITICAL ERROR:", err);
    socket.emit("forward:error", { message: "Internal server error" });
  }
   });


    /* =========================
       🗑️ DELETE MESSAGE(S)
    ========================== */
    socket.on("deleteMessage", async (data) => {
      try {
        const {
          sender,
          messageId,        // OLD (single)
          messageIds = [],  // NEW (multiple)
          conversationId,
          deleteFor = "everyone", // future-proof
        } = data;

        if (!sender || !conversationId) {
          return socket.emit("delete:error", {
            message: "Invalid delete payload",
          });
        }

        /* =========================
           📥 COLLECT MESSAGE IDS
        ========================== */
        const idsToDelete = [];

        if (messageIds.length) {
          idsToDelete.push(...messageIds);
        } else if (messageId) {
          idsToDelete.push(messageId);
        }

        if (!idsToDelete.length) {
          return socket.emit("delete:error", {
            message: "No messages selected",
          });
        }

        /* =========================
           🔐 DELETE FOR EVERYONE
        ========================== */
        if (deleteFor === "everyone") {
          const updatedMessages = await Message.deleteMany(
            {
              _id: { $in: idsToDelete },
              sender: sender, // 🔐 only sender can delete for all
            },
            {
              $set: {
                text: "This message was deleted",
                type: "deleted",
                deletedForEveryone: true,
              },
            }
          );

          // 🔄 Update lastMessage if needed
          const lastMsg = await Message.findOne({
            conversationId,
          }).sort({ createdAt: -1 });

          if (lastMsg) {
            await Conversation.findByIdAndUpdate(conversationId, {
              lastMessage: lastMsg._id,
            });
          }

          /* =========================
             📡 REALTIME EMIT
          ========================== */
          io.to(conversationId.toString()).emit("messageDeleted", {
            messageIds: idsToDelete,
            conversationId,
            hardDelete: true,
            deleteFor: "everyone",
          });

          socket.emit("delete:success", {
            deletedCount: updatedMessages.deletedCount,
          });

          console.log(
            `🗑️ Deleted ${updatedMessages.modifiedCount} messages for everyone`
          );
        }
      } catch (err) {
        console.error("❌ deleteMessage error:", err);

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
        console.log("🔴 User disconnected:", socket.userId);
      }
    });
  });
};