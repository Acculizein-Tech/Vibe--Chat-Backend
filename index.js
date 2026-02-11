//index.js

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
import { setupSocket } from "./utils/socket.js";
import UserContact from "./routes/userContactRoute.js";
import superAdminRoutes from "./routes/superAdminRoute.js";
import uploadRoutes from "./routes/uploadData.js";


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
  "http://localhost:5173",
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

// index.js (after io init)
setupSocket(io);



// export { io };



app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/conversation", conversationRoutes);
app.use("/api/message", messageRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/notification", notificationRoutes);
app.use("/api/usercontacts", UserContact);
app.use("/api/superadmin", superAdminRoutes);
app.use("/api", uploadRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);