import express from 'express';
import { createBusiness, updateBusiness, getAllBusinesses, getBusinessId, getUserBusinessViewsAnalytics, searchBusinesses, getBusinessBySalesId } from '../controllers/businessController.js';
import upload from '../middlewares/upload.js';
import { protect } from '../middlewares/auth.js';
import  roles  from '../middlewares/roles.js';

const router = express.Router();

// Correct fields config (certificate is single)
const mediaFields = upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 },
  { name: 'certificateImages', maxCount: 5 }, // ✅ fixed field name
  { name: 'galleryImages', maxCount: 10 }
]);

router.post('/business', protect, mediaFields, createBusiness);
router.put('/business/:id', protect, mediaFields, roles('superadmin', 'customer', 'admin'), updateBusiness);
// router.get('/business/:id', protect, getBusinessById);
router.get('/businesses', getAllBusinesses)
router.get('/byid/:id', getBusinessId);

router.get('/views/analytics', protect, getUserBusinessViewsAnalytics);
router.get('/search', searchBusinesses);

// 🛡️ Protected route for logged-in sales users
router.get('/sales/listings', protect, getBusinessBySalesId);


export default router;