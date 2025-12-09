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
  socket.on("joinRoom", (conversationId) => {
    if (!conversationId) {
      console.log("❌ joinRoom failed: conversationId missing");
      return;
    }

    socket.join(conversationId.toString());
    console.log(`📌 User ${socket.userId} joined room ${conversationId}`);
  });

  // 3️⃣ Send real-time message
  socket.on("sendMessage", async (data) => {
    try {
      const { sender, receiver, text, conversationId } = data;

      if (!conversationId || !sender || !receiver || !text) {
        console.log("❌ sendMessage failed: Missing fields", data);
        return;
      }

      // Save message to DB
      const msg = await Message.create({
        sender,
        receiver,
        text,
        conversationId,
      });

      // Update conversation's lastMessage
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: msg._id,
      });

      // Emit to room
      io.to(conversationId.toString()).emit("messageReceived", msg);
      console.log(`📤 Message emitted to room ${conversationId}`);

      // Optional: alert receiver if online
      const receiverSocket = onlineUsers.get(receiver.toString());
      if (receiverSocket) {
        io.to(receiverSocket).emit("dmAlert", {
          conversationId,
          sender,
        });
        console.log(`🔔 Alert sent to receiver ${receiver}`);
      }
    } catch (err) {
      console.log("❌ Error in sendMessage:", err);
    }
  });

  // 4️⃣ Disconnect
  socket.on("disconnect", () => {
    console.log("🔴 Socket disconnected:", socket.id);

    for (const [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid);
        console.log("📝 Removed from onlineUsers:", uid);
      }
    }
  });
});

// export { io };



app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/conversation", conversationRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/contacts", contactRoutes);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
 