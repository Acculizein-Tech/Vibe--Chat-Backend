import express from 'express';
import upload from '../middlewares/upload.js';
import { getUserProfile, updateUserProfile, getUserReviews, getUserListings, getAllSalesUsers, getUsersByReferral,
   getWalletInfo, applyReferral, createCustomCode, getCustomCodes, UpdateCustomCode, DeleteCustomCode, blockUser, unblockUser, getBlockedUsers, filterContacts, deleteUserAccount } from '../controllers/userController.js';


import { protect } from '../middlewares/auth.js';
import roles from '../middlewares/roles.js';

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
router.get('/getWalletInfo', protect, getWalletInfo);
router.get('/getreferralUser', protect, getUsersByReferral); // Get users by referral code
router.get('/codes', protect, getCustomCodes); // Get custom codes for superadmin

//addrefferal
router.post("/apply-referral", protect, applyReferral);
router.post("/custom-code", protect, roles('superadmin'), createCustomCode);
router.delete("/delete-code/customcode", protect, roles('superadmin'), DeleteCustomCode);
router.put("/update-code/customcode", protect, roles('superadmin'), UpdateCustomCode);

 
router.post("/block", blockUser);
router.post("/unblock", unblockUser);
router.get("/blocked/:userId", getBlockedUsers);

// ✅ New route to filter contacts
router.post("/filterContacts", protect, filterContacts);
router.delete("/delete-account", protect, deleteUserAccount);

export default router;
