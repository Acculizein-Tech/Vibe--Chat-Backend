import express from 'express';
import { getAllPlans, createPricePlan, updatePlan, deletePlan } from '../controllers/plansController.js';

import { protect } from '../middlewares/auth.js';          // JWT verify
import  roles  from '../middlewares/roles.js';   // role guard


const router = express.Router();

router.get('/plans', getAllPlans);
router.post('/plans', protect, roles('superadmin'), createPricePlan);
router.put('/plans/:id', protect, roles('superadmin'), updatePlan);
router.delete('/plans/:id', protect, roles('superadmin'), deletePlan);

export default router;
