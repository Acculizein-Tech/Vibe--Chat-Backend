// routes/eventRoutes.js
import express from 'express';
import { createEvent, updateEvent, deleteEvent, getEventsByBusiness, approveEvent, getEventsByUser, getAllEvents } from '../controllers/eventsController.js';
import upload from '../middlewares/upload.js';
import { protect } from '../middlewares/auth.js';
import roles from '../middlewares/roles.js';

const router = express.Router();

// Single file upload for bannerImage
const bannerUpload = upload.single('coverImage');

// 👤 Customer or Business 
router.post('/', protect, bannerUpload, createEvent);
router.put('/:id', protect, bannerUpload, updateEvent);
router.delete('/:id', protect, deleteEvent);
router.get('/event/:businessId', getEventsByBusiness);
router.get('/my-events', protect, getEventsByUser);
router.get('/', protect, roles('superadmin', 'admin'), getAllEvents); // Admin can also view all user events

// 🔐 Superadmin approval route
router.put(
  '/approve/:id',
  protect,
  roles('superadmin'),
  bannerUpload,  // ✅ Use single if only 1 image (as per your backend)
  approveEvent
);

export default router;
