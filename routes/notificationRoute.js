// routes/notificationRoutes.js
import express from 'express';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../controllers/notificationController.js';
import { protect } from '../middlewares/auth.js';
import role from '../middlewares/roles.js';

const router = express.Router();

router.get('/getdata', protect, role('customer'), getNotifications);
// router.get('/', protect, getUserNotifications);
router.patch('/:id/read', protect, role('customer'), markNotificationAsRead);
router.patch('/mark-all-read', protect, role('customer'), markAllNotificationsAsRead);


export default router;
