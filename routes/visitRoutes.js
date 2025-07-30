import express from 'express';
import { trackVisit, getVisitAnalytics, getUserBusinessAnalytics } from '../controllers/visitController.js';
import { protect } from '../middlewares/auth.js';
import roles from '../middlewares/roles.js';

const router = express.Router();

// ✅ Guest or logged-in user tracking visit
router.post('/track', trackVisit);

// ✅ Superadmin can view analytics
router.get('/analytics', protect, roles('superadmin'), getVisitAnalytics);   //GET http://localhost:5000/api/visit/analytics?filter=6months for check the 6 months and for week

router.get(
  '/my-analytics',
  protect, // user must be logged in
  roles('customer'), // or any role you allow
  getUserBusinessAnalytics
);


export default router;
