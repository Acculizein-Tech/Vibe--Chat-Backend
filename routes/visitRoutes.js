import express from 'express';
import { trackVisit, getVisitAnalytics } from '../controllers/visitController.js';
import { protect } from '../middlewares/auth.js';
import roles from '../middlewares/roles.js';

const router = express.Router();

// ✅ Guest or logged-in user tracking visit
router.post('/track', trackVisit);

// ✅ Superadmin can view analytics
router.get('/analytics', protect, roles('superadmin'), getVisitAnalytics);

export default router;
