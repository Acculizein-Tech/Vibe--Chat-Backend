import express from 'express';
import { getSalesDashboardStats, getReferralLink } from '../controllers/salesController.js';
const router = express.Router();
import { protect } from '../middlewares/auth.js';
import roles from '../middlewares/roles.js';

// Requires authentication middleware to attach req.user
router.get('/dashboard', protect, getSalesDashboardStats);
router.get('/referral-link', protect, roles('sales', 'superadmin', 'customer'), getReferralLink);

export default router;


// =============================
// 📁 utils/generateReferralCode.js
// =============================
// export function generateReferralCode(prefix = "SLS") {
//   const random = Math.floor(1000 + Math.random() * 9000);
//   return `${prefix}${random}`;
// }