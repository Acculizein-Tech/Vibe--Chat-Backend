// // utils/sendNotification.js
// import Notification from '../models/Notification.js';
// import User from '../models/user.js';

// let io = null;
// let onlineUsers = null;

// export const initNotificationSystem = (_io, _onlineUsers) => {
//   io = _io;
//   onlineUsers = _onlineUsers;
//   console.log("✅ Notification system initialized");
// };

// // 🔔 Send notification to specific user
// export const notifyUser = async ({ userId, type, title, message, data = {} }) => {
//   try {
//     if (!io || !onlineUsers) return;

//     const user = await User.findById(userId).select('role');
//     if (!user) return;

//     const notification = await Notification.create({
//       user: userId,
//       role: user.role,
//       type,
//       title,
//       message,
//       data,
//     });

//     const payload = {
//       _id: notification._id,
//       type,
//       title,
//       message,
//       data,
//       createdAt: notification.createdAt,
//       read: false,
//     };

//     const roomName = `user_${userId.toString()}`;
//     console.log(`📤 Emitting to ${roomName}`, payload);

//     io.to(roomName).emit('new_notification', payload); // ✅ only to that user
//     return notification;
//   } catch (err) {
//     console.error('❌ notifyUser error:', err.message);
//   }
// };

// // 🔔 Send notification to role (admin / superadmin)
// export const notifyRole = async ({ role, type, title, message, data = {} }) => {
//   try {
//     if (!io) return;

//     if (!['admin', 'superadmin'].includes(role)) return; // ✅ only allowed roles

//     const notification = await Notification.create({
//       user: null,
//       role,
//       type,
//       title,
//       message,
//       data,
//     });

//     const payload = {
//       _id: notification._id,
//       type,
//       title,
//       message,
//       data,
//       createdAt: notification.createdAt,
//       read: false,
//     };

//     console.log(`📨 Emitting to role_${role}`, payload);

//     io.to(`role_${role}`).emit('new_notification', payload); // ✅ only to role room
//     return notification;
//   } catch (err) {
//     console.error(`❌ notifyRole error for ${role}:`, err.message);
//   }
// };
