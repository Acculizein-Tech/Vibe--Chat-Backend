// routes/notificationRoutes.js
import express from 'express';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUserNotifications,
  markConversationNotificationsAsRead,
} from '../controllers/notificationController.js';
import { protect } from '../middlewares/auth.js';
import role from '../middlewares/roles.js';
import User from '../models/user.js';

const router = express.Router();

router.get('/getdata', protect, role('customer'), getNotifications);
router.get('/unread', protect, getUserNotifications);
router.patch('/conversation/:conversationId/read', protect, markConversationNotificationsAsRead);
router.patch('/:id/read', protect, role('customer'), markNotificationAsRead);
router.patch('/mark-all-read', protect, role('customer'), markAllNotificationsAsRead);

//push notification token update
router.post("/register-device", protect, async (req, res) => {
  const platform = String(req.body?.platform || "").toLowerCase();
  const normalizedPlatform = platform === "ios" ? "ios" : platform === "android" ? "android" : null;
  const sessionMinutes = Math.max(0, Number(req.body?.sessionMinutes || 0));
  const avgResponseMs = Math.max(0, Number(req.body?.avgResponseMs || 0));

  const updates = {
    pushToken: req.body.pushToken,
  };

  if (normalizedPlatform) {
    updates[`deviceUsage.${normalizedPlatform}.lastSeenAt`] = new Date();
    if (avgResponseMs > 0) {
      updates[`deviceUsage.${normalizedPlatform}.avgResponseMs`] = avgResponseMs;
    }
  }

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: updates,
      ...(normalizedPlatform
        ? {
            $inc: {
              [`deviceUsage.${normalizedPlatform}.sessionCount`]:
                sessionMinutes > 0 ? 1 : 0,
              [`deviceUsage.${normalizedPlatform}.totalUsageMinutes`]: sessionMinutes,
            },
          }
        : {}),
    },
    { new: true }
  );

  res.json({ success: true });
});

export default router;
