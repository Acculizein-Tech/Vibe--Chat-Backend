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



        /* =========================
     🔁 FORWARD MESSAGE (PRODUCTION)
  ========================= */

        socket.on("forwardMessage", async (data) => {
          try {
            const {
              sender,

              // OLD (backward compatible)
              messageId,
              text,

              // NEW
              messageIds = [],

              targetConversationIds = [],
            } = data;

            if (!sender || !targetConversationIds.length) {
              return socket.emit("forward:error", {
                message: "Invalid forward payload",
              });
            }

            /* =========================
               🔒 FORWARD LIMIT (PROD)
            ========================== */
            const MAX_FORWARD_LIMIT = 5;

            if (targetConversationIds.length > MAX_FORWARD_LIMIT) {
              return socket.emit("forward:error", {
                message: `You can forward messages to only ${MAX_FORWARD_LIMIT} chats`,
              });
            }

            /* =========================
               📥 COLLECT ORIGINAL MESSAGES
            ========================== */
            let originals = [];

            // NEW multi-message
            if (messageIds.length) {
              originals = await Message.find({
                _id: { $in: messageIds },
              }).sort({ createdAt: 1 });
            }

            // OLD single message
            if (!originals.length && messageId) {
              const msg = await Message.findById(messageId);
              if (msg) originals = [msg];
            }

            // Direct text forward
            if (!originals.length && text) {
              originals = [
                {
                  text,
                  sender: null,
                },
              ];
            }

            if (!originals.length) {
              return socket.emit("forward:error", {
                message: "Nothing to forward",
              });
            }

            /* =========================
               🔁 FAN-OUT BUILD (CORE)
            ========================== */
            const messagesToInsert = [];

            for (const conversationId of targetConversationIds) {
              for (const original of originals) {
                messagesToInsert.push({
                  sender,
                  receiver: null,
                  conversationId,
                  text: original.text,
                  forwarded: true,
                  forwardedFrom: original.sender || null,
                });
              }
            }

            /* =========================
               💾 BULK INSERT
            ========================== */
            const savedMessages = await Message.insertMany(messagesToInsert);

            /* =========================
               🔄 UPDATE CONVERSATIONS
            ========================== */
            const lastMessageMap = {};

            savedMessages.forEach((msg) => {
              lastMessageMap[msg.conversationId] = msg._id;
            });

            await Promise.all(
              Object.entries(lastMessageMap).map(([cid, msgId]) =>
                Conversation.findByIdAndUpdate(cid, {
                  lastMessage: msgId,
                })
              )
            );

            /* =========================
               📡 REALTIME EMIT
            ========================== */
            savedMessages.forEach((msg) => {
              io.to(msg.conversationId.toString()).emit("messageReceived", msg);

              io.emit("chat:list:update", {
                conversationId: msg.conversationId,
                text: msg.text,
                sender: msg.sender,
                createdAt: msg.createdAt,
              });
            });

            /* =========================
               ✅ SUCCESS RESPONSE
            ========================== */
            socket.emit("forward:success", {
              forwardedChats: targetConversationIds.length,
              forwardedMessages: savedMessages.length,
            });

            console.log(
              `🔁 Forwarded ${savedMessages.length} messages to ${targetConversationIds.length} chats`
            );
          } catch (err) {
            console.error("❌ forwardMessage error:", err);

            socket.emit("forward:error", {
              message: "Failed to forward messages",
            });
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
              const updatedMessages = await Message.updateMany(
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
                deleteFor: "everyone",
              });

              socket.emit("delete:success", {
                deletedCount: updatedMessages.modifiedCount,
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