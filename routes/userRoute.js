import express from 'express';
import upload from '../middlewares/upload.js';

import { getUserProfile, updateUserProfile, getUserReviews, getUserListings, getAllSalesUsers, getUsersByReferral } from '../controllers/userController.js';
import { protect } from '../middlewares/auth.js';

const router = express.Router();

// @route   GET /api/user/profile/:id
// @desc    Get user profile
// @access  Private
router.get('/profile/:id', protect, getUserProfile);
 
// @route   POST /api/user/profile/:id 
// @desc    Update user profile
// @access  Private
router.put(
  '/profile/:id',
  protect,
  upload.single('others'), // ⬅️ This handles uploading the image
  updateUserProfile
);
// 🔐 Example: Only allow business owners to access their own reviews
router.get('/my-business-reviews', protect, getUserReviews);
router.get('/getbusinessbyid', protect, getUserListings);
router.get('/getAllSalesUsers', protect, getAllSalesUsers);

router.get('/getreferralUser', protect, getUsersByReferral); // Get users by referral code
// router.get('/getbusinessbyid/:id', protect, getUserBusinesses);

export default router;
