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
