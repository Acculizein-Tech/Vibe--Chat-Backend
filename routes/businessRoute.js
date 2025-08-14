import express from 'express';
import { createBusiness, updateBusiness, getAllBusinesses, getBusinessId, getUserBusinessViewsAnalytics, searchBusinesses, getBusinessBySalesId, businessCountByCategory, deleteBusinessListingById, softDeleteBusiness, switchBusinessPlan, getMyBusinesses, updateBusinessPricing } from '../controllers/businessController.js';
import upload from '../middlewares/upload.js';
import { protect } from '../middlewares/auth.js';
import  roles  from '../middlewares/roles.js';

const router = express.Router();

// Correct fields config (certificate is single)
const mediaFields = upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'coverImage', maxCount: 1 },
  { name: 'certificateImages', maxCount: 5 }, // ✅ fixed field name
  { name: 'galleryImages', maxCount: 10 },
{ name: 'aadhaarFront', maxCount: 1 },
{ name: 'aadhaarBack', maxCount: 1 },
 { name: 'driverPhoto', maxCount: 1 },       // ✅ New: Driver Photo
  { name: 'licenseCopy', maxCount: 1 },
]);

router.post('/business', protect, mediaFields, createBusiness);
router.put('/business/:id', protect, mediaFields, roles('superadmin', 'customer', 'admin'), updateBusiness);
// router.get('/business/:id', protect, getBusinessById);
router.get('/businesses', getAllBusinesses)
router.get('/byid/:id', getBusinessId);
router.patch('/switch', protect, roles('superadmin', 'admin'), switchBusinessPlan);
router.get('/views/analytics', protect, getUserBusinessViewsAnalytics);
router.get('/search', searchBusinesses);
router.get('/count', businessCountByCategory);
// 🛡️ Protected route for logged-in sales users
router.get('/sales/listings', protect, getBusinessBySalesId);

router.get('/my-businesses', protect, roles('customer'), getMyBusinesses);  //pricing
router.put('/update-pricing/:id', protect, roles('customer'), updateBusinessPricing);
router.delete('/deleteBusiness/:id', protect, roles('superadmin', 'customer'), deleteBusinessListingById);

router.delete('/softgo/:id', protect, roles('customer'), softDeleteBusiness);

export default router;