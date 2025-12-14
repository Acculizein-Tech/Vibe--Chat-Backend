// routes/notificationRoutes.js
import express from 'express';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../controllers/notificationController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', protect, getNotifications);
// router.get('/', protect, getUserNotifications);
router.patch('/:id/read', protect, markNotificationAsRead);
router.patch('/mark-all-read', protect, markAllNotificationsAsRead);


export default router;
