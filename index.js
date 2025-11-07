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

dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use(requestIp.mw());
app.use(cors({ origin: "*",   methods: ["GET", "POST", "PUT", "DELETE"], credentials: true }));

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("🟢 New socket connected:", socket.id);

  socket.on("register", (userId) => {
    onlineUsers.set(userId, socket.id);
    console.log(`✅ User ${userId} registered with socket ${socket.id}`);
  });

  socket.on("sendMessage", (data) => {
    console.log("📩 Message received from client:", data);

    const { sender, receiver, text, conversationId } = data;
    const receiverSocket = onlineUsers.get(receiver);

    // 🔍 Debug: who is online
    console.log("👥 Online users:", Array.from(onlineUsers.entries()));

    if (receiverSocket) {
      console.log(`📤 Sending message to receiver ${receiver} via socket ${receiverSocket}`);
      io.to(receiverSocket).emit("receiveMessage", { sender, text, conversationId });
    } else {
      console.log(`⚠️ Receiver ${receiver} is offline, not delivered in real-time`);
    }
  });

  socket.on("disconnect", () => {
    for (const [userId, sockId] of onlineUsers.entries()) {
      if (sockId === socket.id) {
        onlineUsers.delete(userId);
        console.log(`🔴 User ${userId} disconnected`);
      }
    }
  });
});


app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/conversation", conversationRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/contacts", contactRoutes);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
