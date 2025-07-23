
// routes/superAdminRoutes.js

import express from 'express';
import { getAllUsers, getAllBusinessListings, updateUserProfile, deleteBusinessListingById, addNewUser, createUserBySuperAdmin, handleDeleteRequest, handleDeleteRequestforBusiness, deleteUserById } from '../controllers/SuperAdminController.js';
import { protect } from '../middlewares/auth.js';          // JWT verify
import  roles  from '../middlewares/roles.js';   // role guard
import upload from '../middlewares/upload.js';
import { checkPermission } from '../middlewares/checkPermission.js'; // Permission check middleware


const router = express.Router();

// Only accessible to logged-in users with superadmin role
router.get('/users', protect, roles('superadmin', "admin"), getAllUsers);


// ✅ New route: Get all business listings
router.get('/businesses', protect, roles('superadmin', 'admin'), getAllBusinessListings);
router.put('/updateUser/:id', protect, roles('superadmin', 'admin'), updateUserProfile);
router.delete('/deleteBusiness/:id', protect, roles('superadmin'), deleteBusinessListingById);
router.post('/AddnewUser', protect, upload.single('userImage'), roles('superadmin','admin'), addNewUser);
router.delete('/deleteUser/:id', protect, roles('superadmin'), deleteUserById);
router.post(
  '/create-user',
  protect,
  checkPermission('create_user'),
  createUserBySuperAdmin
);
router.put(
  '/delete-requests/:requestId',
  protect,
  roles('superadmin'),
  handleDeleteRequest
);
router.put('/delete-requests/:requestId', protect, roles('superadmin'), handleDeleteRequestforBusiness);

export default router;
