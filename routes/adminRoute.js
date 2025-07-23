import express from 'express';
import { protect } from '../middlewares/auth.js';
import roles from '../middlewares/roles.js';
import { getDashboardStats, requestUserDeletion, requestBusinessDeletion } from '../controllers/adminController.js';

const router = express.Router();

// SUPERADMIN ONLY ROUTE
router.get(
  '/dashboard',
  protect,
  roles('superadmin'),
  getDashboardStats
);
router.post('/delete-request', protect, roles('superadmin'), requestUserDeletion)
router.post('/request-delete-business', protect, roles('admin'), requestBusinessDeletion);

export default router;