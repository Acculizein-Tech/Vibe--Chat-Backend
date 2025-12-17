import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import cors from "cors";
import requestIp from "request-ip";

import authRoutes from "./routes/authRoute.js";
import userRoutes from "./routes/userRoute.js";
import conversationRoutes from "./routes/conversationRoute.js";
import messageRoutes from "./routes/messageRoute.js";
import { errorHandler } from "./utils/errorHandler.js";
import contactRoutes from "./routes/contactRoute.js";
import Message from "./models/Message.js";
import Conversation from "./models/Conversation.js";
import notificationRoutes from "./routes/notificationRoute.js";
import Notification from "./models/Notification.js";


dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use(requestIp.mw());
const allowedOrigins = [
  "http://localhost:8081",
  "http://192.168.",
  "exp://",
  "https://*.exp.direct",
  "https://*.expo.dev",
  "https://1xqi04y-sharma9299-8081.exp.direct",
  "https://vibechat.bizvility.com",
  "https://www.vibechat.bizvility.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.some((o) => origin.includes(o))) {
        callback(null, true);
      } else {
        console.log("❌ Blocked CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

const httpServer = http.createServer(app);
export const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ----------------------------------------------------------
// REAL-TIME SOCKET SYSTEM WITH FULL DEBUGGING
// ----------------------------------------------------------
const onlineUsers = new Map();

// ✅ ADD THIS
const activeConversationUsers = new Map();

io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);

  // Debug: log all events received by this socket
  socket.onAny((event, ...args) => {
    console.log(`📌 Event received: ${event}`, args);
  });

  // 1️⃣ Register user
  socket.on("register", (userId) => {
    if (!userId) return;

    onlineUsers.set(userId.toString(), socket.id);
    socket.userId = userId.toString();

    console.log("🟢 Registered → onlineUsers map:", onlineUsers);
  });

  // 2️⃣ Join a conversation room
 socket.on("joinRoom", ({ conversationId, userId }) => {
  if (!conversationId || !userId) return;

  socket.join(conversationId.toString());

  if (!activeConversationUsers.has(conversationId.toString())) {
    activeConversationUsers.set(conversationId.toString(), new Set());
  }

  activeConversationUsers
    .get(conversationId.toString())
    .add(userId.toString());

  console.log(
    `🟢 User ${userId} active in conversation ${conversationId}`,
    activeConversationUsers.get(conversationId.toString())
  );
});


  // 3️⃣ Send real-time message
  socket.on("sendMessage", async (data) => {
  try {
    const { sender, receiver, text, conversationId } = data;

    if (!conversationId || !sender || !receiver || !text) return;

    // 1️⃣ Save message
    const msg = await Message.create({
      sender,
      receiver,
      text,
      conversationId,
    });

    // 2️⃣ Update conversation
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: msg._id,
    });

    // 3️⃣ Emit message
    io.to(conversationId.toString()).emit("messageReceived", msg);

    // 4️⃣ CHECK receiver activity
    const activeUsers =
      activeConversationUsers.get(conversationId.toString()) || new Set();

    const receiverIsActive = activeUsers.has(receiver.toString());

    // 5️⃣ Create notification ONLY if inactive
    if (!receiverIsActive) {
      await Notification.create({
        recipient: receiver,
        scope: "USER",
        type: "NEW_MESSAGE",
        title: "New message",
        message: text.length > 30 ? text.slice(0, 30) + "..." : text,
        data: {
          conversationId,
          senderId: sender,
        },
      });

      console.log("🔔 Notification created for", receiver);
    }

  } catch (err) {
    console.log("❌ Error in sendMessage:", err);
  }
});

socket.on("leaveRoom", ({ conversationId, userId }) => {
  if (!conversationId || !userId) return;

  socket.leave(conversationId.toString());

  activeConversationUsers
    .get(conversationId.toString())
    ?.delete(userId.toString());

  console.log(
    `🔴 User ${userId} left conversation ${conversationId}`,
    activeConversationUsers.get(conversationId.toString())
  );
});


  // 4️⃣ Disconnect
 socket.on("disconnect", () => {
  console.log("🔴 Socket disconnected:", socket.id);

  for (const [convId, users] of activeConversationUsers.entries()) {
    users.delete(socket.userId);
    if (users.size === 0) {
      activeConversationUsers.delete(convId);
    }
  }

  onlineUsers.delete(socket.userId);
});
});

// export { io };



app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/conversation", conversationRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/notification", notificationRoutes);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
 