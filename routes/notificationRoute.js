// routes/notificationRoutes.js
import express from 'express';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../controllers/notificationController.js';
import { protect } from '../middlewares/auth.js';
import role from '../middlewares/roles.js';
import User from '../models/user.js';

const router = express.Router();

router.get('/getdata', protect, role('customer'), getNotifications);
// router.get('/', protect, getUserNotifications);
router.patch('/:id/read', protect, role('customer'), markNotificationAsRead);
router.patch('/mark-all-read', protect, role('customer'), markAllNotificationsAsRead);

//push notification token update
router.post("/register-device", protect, async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    pushToken: req.body.pushToken,
  });

  res.json({ success: true });
});

export default router;
