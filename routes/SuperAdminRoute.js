//SuperAdminRoute.js


// routes/superAdminRoutes.js

import express from 'express';
import { getAllUsers, addNewUser, updateUserProfile, deleteUserById } from '../controllers/SuperAdminController.js';
import { protect } from '../middlewares/auth.js';          // JWT verify
import  roles  from '../middlewares/roles.js';   // role guard
import upload from '../middlewares/upload.js';

// import upload from '../middlewares/upload.js';

const router = express.Router();

const rewardUpload = upload.single('rewardImage');
// Only accessible to logged-in users with superadmin role
router.get('/users', protect, roles('superadmin', "admin"), getAllUsers);

router.post('/AddnewUser', protect, upload.single('userImage'), roles('superadmin','admin'), addNewUser);
router.delete('/deleteUser/:id', protect, roles('superadmin'), deleteUserById);

router.put('/updateUser/:id', protect, roles('superadmin', 'admin'), updateUserProfile);

export default router;