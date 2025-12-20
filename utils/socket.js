import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
import Notification from "../models/Notification.js";
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
      const { sender, receiver, text, conversationId } = data;

      console.log("📨 sendMessage received:", data);

      const msg = await Message.create({
        sender,
        receiver,
        text,
        conversationId,
      });

      io.to(conversationId).emit("messageReceived", msg);
      console.log("📤 messageReceived emitted");

      const viewers =
        activeViewers.get(conversationId) || new Set();

      const receiverActive = viewers.has(receiver);

      if (!receiverActive) {
        const notification = await Notification.create({
          recipient: receiver,
          scope: "USER",
          type: "NEW_MESSAGE",
          title: "New Message",
          message: text.slice(0, 30),
          data: { conversationId, senderId: sender },
          isRead: false,
        });

        console.log("🔔 Notification CREATED:", notification._id);

        const socketId = onlineUsers.get(receiver);
        if (socketId) {
          io.to(socketId).emit("newNotification", notification);
          console.log("📡 Notification SENT realtime");
        }
      } else {
        console.log("🚫 Receiver active → no notification");
      }
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(socket.userId);
    });
  });
};
