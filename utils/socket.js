import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Notification from "../models/Notification.js";
import { sendPushNotification } from "./pushService.js";
import User from "../models/user.js";

import {
  onlineUsers,
  activeConversationViewers,
} from "./socketState.js";

export const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.id);

    socket.on("register", (userId) => {
      onlineUsers.set(userId.toString(), socket.id);
      socket.userId = userId.toString();
    });

    socket.on("joinRoom", ({ conversationId }) => {
      socket.join(conversationId.toString());
    });

    socket.on("conversationOpen", ({ conversationId, userId }) => {
      if (!activeConversationViewers.has(conversationId)) {
        activeConversationViewers.set(conversationId, new Set());
      }
      activeConversationViewers.get(conversationId).add(userId);
    });

    socket.on("conversationClose", ({ conversationId, userId }) => {
      activeConversationViewers.get(conversationId)?.delete(userId);
    });

    // 🔥🔥🔥 REAL-TIME MESSAGE HANDLER 🔥🔥🔥
    // socket.on("sendMessage", async (data) => {
    //   try {
    //     const { sender, receiver, text, conversationId } = data;

    //     if (!sender || !receiver || !text || !conversationId) return;

    //     // 1️⃣ Save message
    //     const message = await Message.create({
    //       sender,
    //       receiver,
    //       text,
    //       conversationId,
    //     });

    //     await Conversation.findByIdAndUpdate(conversationId, {
    //       lastMessage: message._id,
    //     });

    //     // 2️⃣ Real-time message
    //     io.to(conversationId.toString()).emit("messageReceived", message);

    //     // 3️⃣ Notification logic
    //     const viewers =
    //       activeConversationViewers.get(conversationId.toString()) || new Set();

    //     const receiverViewing = viewers.has(receiver.toString());

    //     if (!receiverViewing) {
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
    //           notification
    //         );
    //       }
    //     }
    //   } catch (err) {
    //     console.log("❌ sendMessage socket error:", err);
    //   }
    // });
     // 🔥 REAL SEND MESSAGE
socket.on("sendMessage", async (data) => {
  try {
    const { sender, receiver, text, conversationId } = data;
    if (!sender || !receiver || !text || !conversationId) return;

    console.log("📨 sendMessage received:", data);

    // 0️⃣ Safety: sender == receiver
    if (sender.toString() === receiver.toString()) {
      console.log("🚫 Sender === Receiver → skip");
      return;
    }

    // 1️⃣ Save message
    const msg = await Message.create({
      sender,
      receiver,
      text,
      conversationId,
    });

    // 2️⃣ Emit realtime message
    io.to(conversationId.toString()).emit("messageReceived", msg);

    // 3️⃣ Check active viewers
    const viewers =
      activeConversationViewers.get(conversationId.toString()) || new Set();

    const receiverActive = viewers.has(receiver.toString());
    if (receiverActive) {
      console.log("🚫 Receiver active → no notification");
      return;
    }

    // 4️⃣ Create DB notification
    const notification = await Notification.create({
      recipient: receiver,
      scope: "USER",
      type: "NEW_MESSAGE",
      title: "New Message",
      message: text.length > 40 ? text.slice(0, 40) + "…" : text,
      data: { conversationId, senderId: sender },
      isRead: false,
    });

    console.log("🔔 Notification CREATED:", notification._id);

    // 5️⃣ Realtime socket notification
    const receiverSocketId = onlineUsers.get(receiver.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newNotification", notification);
      console.log("📡 Realtime notification sent");
    }

    // 6️⃣ Push notification (ONLY if receiver offline)
    if (!receiverSocketId) {
      const receiverUser = await User.findById(receiver).select("pushToken");
      const senderUser = await User.findById(sender).select("fullName");

      if (receiverUser?.pushToken) {
        await sendPushNotification({
          pushToken: receiverUser.pushToken,
          title: `${senderUser.fullName} • Vibechat`,
          body: text.length > 40 ? text.slice(0, 40) + "…" : text,
          data: {
            type: "CHAT_MESSAGE",
            conversationId,
            senderId: sender,
          },
        });

        console.log("📲 Push notification sent");
      } else {
        console.log("⚠️ No push token for receiver");
      }
    }

  } catch (err) {
    console.error("❌ sendMessage socket error:", err);
  }
});



    socket.on("disconnect", () => {
      onlineUsers.delete(socket.userId);
    });
  });
};
