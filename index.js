import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import connectDB from './config/db.js';
import authRoutes from './routes/authRoute.js'; 
import adminRoutes from './routes/adminRoute.js';
import { errorHandler } from './utils/errorHandler.js';
import businessRoutes from './routes/businessRoute.js';
import userRoutes from './routes/userRoute.js';
import superAdminRoute from './routes/superAdminRoute.js';
import plansRoute from './routes/plansRoute.js';
import reviewRoute from './routes/reviewRoute.js';
import permissionRoute from './routes/permissionRoute.js';
import roleRoute from './routes/roleRoute.js';
import path from 'path';
import requestIp from 'request-ip';
import salesRoute from './routes/salesRoute.js';
import eventRoutes from './routes/eventRoute.js';
import visitRoutes from './routes/visitRoutes.js';
import leadsRoute from './routes/leadsRoute.js'; // Import leads route
import notificationRoutes from './routes/notificationRoute.js';
import paymentRoutes from "./routes/paymentRoute.js";
import uploadRoutes from './routes/uploadData.js'; // Import upload routes
import enquiryRoutes from './routes/enquiryRoute.js'; // Import enquiry routes
import advertisementRoutes from './routes/advertisementRoutes.js'; // Advertisement routes
// import redeemRoutes from './routes/redeemRoutes.js'; // Import redeem routes
import KYCroute from './routes/KYCroute.js'; // Import KYC routes
// import User from './models/user.js';
import './cronJobs/leadReminderJob.js';
import cors from 'cors';
// dotenv.config();

// Must be first
const envFile = process.env.ENV_FILE || ".env";

// Force load
const result = dotenv.config({
  path: path.resolve(process.cwd(), envFile),
  override: true   // 👈 force overwrite previous values
});

console.log("✅ ENV_FILE:", envFile);
// console.log("✅ dotenv result:", result);
console.log("✅ PORT:", process.env.PORT);
console.log("✅ MONGO_URI:", process.env.MONGO_URI);

const app = express();

// Database connection
connectDB();
app.use(requestIp.mw());



// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// startLeadReminderCron(); // ✅ This starts the cron job at 9:00 AM daily
// CORS

const allowedOrigins = [
  'https://bizvility.com',
  'https://testing.bizvility.com',
  'http://localhost:5173'

];
// app.use(cors({
//   origin:  '*',
//   methods: ['GET', 'POST', 'PUT','PATCH', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true,
//   exposedHeaders: ['Content-Type']
// }));


app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT','PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ✅ Create HTTP server and bind to Express
const httpServer = http.createServer(app);

// 🔌 Setup Socket.IO server
// const io = new Server(httpServer, {
//   cors: {
//     origin: '*', // Adjust as needed for frontend domain
//     methods: ['GET', 'POST']
//   }
// });

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});

// ✅ Global user socket map
const onlineUsers = new Map();

// 🎯 Socket.IO connection
io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);

  // Handle user registration
  socket.on("register", (data) => {

    
    console.log("📩 Received register payload:", data);

    // 🚫 Reject invalid data
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      console.warn("❌ Invalid register payload. Expected an object with userId and role.");
      return;
    }

    const { userId, role } = data;

    // 🚫 Reject if userId is not a string
    if (!userId || typeof userId !== "string") {
      console.warn("⚠️ Invalid or missing userId in registration.");
      return;
    }

    const userStr = userId.trim();
    onlineUsers.set(userStr, socket.id); // ✅ store string key only

    // Join per-user room
    socket.join(`user_${userStr}`);

    // Join role-based room
    if (role && typeof role === "string") {
      socket.join(`role_${role}`);
    }

    console.log(`🟢 User ${userStr} joined room`);
    console.log("✅ Current onlineUsers:", Array.from(onlineUsers.entries()));
  });
  // register event me
// socket.on("register", async (data) => {
//   const { userId } = data;

//   const user = await User.findById(userId).select("role");
//   if (!user) return;



//   console.log(
//     `📝 Register event: userId=${userId}, role=${user.role}, socketId=${socket.id}`
//   );

//   socket.join(`user_${userId}`);
//   socket.join(`role_${user.role}`);
// });


  // Cleanup on disconnect
  socket.on("disconnect", () => {
    for (const [userId, sockId] of onlineUsers.entries()) {
      if (sockId === socket.id) {
        onlineUsers.delete(userId);
        console.log(`🔴 Disconnected: ${userId}`);
        break;
      }
    }
  });
});
import { initNotificationSystem } from './utils/sendNotification.js';
initNotificationSystem(io, onlineUsers);

// Make io and onlineUsers accessible globally
export { io, onlineUsers };


// console.log("RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID);
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/user', userRoutes);
app.use('/api/superadmin', superAdminRoute);
app.use('/api/plan', plansRoute);
app.use('/api/reviews', reviewRoute);
app.use('/api/sales', salesRoute); // Sales route for sales dashboard and referral link
app.use('/api/permissions', permissionRoute);
app.use('/api/roles', roleRoute);
app.use('/api/events', eventRoutes);
app.use('/api/visit', visitRoutes);
app.use('/api/leads', leadsRoute); // Leads management route
app.use('/api/notifications', notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.use('/api/upload', uploadRoutes); // Use upload routes
app.use('/api/enquiries', enquiryRoutes); // Use enquiry routes
// app.use('/api/redeem', redeemRoutes); // Use redeem routes
app.use('/api/kyc', KYCroute); // Use KYC routes
app.use('/api/ads', advertisementRoutes); // Advertisement routes
app.use("/invoices", express.static(path.join(path.resolve(), "invoices")));


// ✅ Serve static files from 'uploads' folder
// app.use('/uploads', express.static(path.join(path.resolve(), 'uploads')));
// Error handling
app.use(errorHandler);

const PORT = process.env.PORT;
httpServer.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections global error handler
process.on('unhandledRejection', (err) => {
  console.error(`Error: ${err.message}`);
  httpServer.close(() => process.exit(1));
});
