import express from 'express';
import { protect } from '../middlewares/auth.js';
import  roles  from '../middlewares/roles.js';   // role guard
import {
  createLead,
  getLeadsForUser,
  updateLead,
  deleteLead,
  getLeadStats,
  assignLeadsToSalesUser,
  getAllLeads,
  getLeadCountsPerSalesUser
} from '../controllers/leadController.js';
  
const router = express.Router();

router.use(protect); // Ensure only logged-in users access

router.post('/', createLead);            // Create a lead
router.get('/', getLeadsForUser);        // Fetch all leads for a user
router.put('/assign', protect, roles('superadmin', 'admin'), assignLeadsToSalesUser);
router.put('/:id', roles('superadmin', 'admin'), updateLead);          // Update a lead
router.delete('/:id', deleteLead);       // Delete a lead
router.get('/stats', getLeadStats);    // Get lead statistics (if implemented)

router.get('/all', protect, roles('admin', 'superadmin'), getAllLeads);
router.get('/lead-counts', protect, roles('superadmin'), getLeadCountsPerSalesUser);

export default router;
  