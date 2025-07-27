import express from 'express';
import { createEnquiry, getAllEnquiries } from '../controllers/enquiryController.js';
import upload from '../middlewares/upload.js';
import { protect } from '../middlewares/auth.js';
import  roles  from '../middlewares/roles.js';

const router = express.Router();

router.post('/createEnquiry', protect,  createEnquiry);
router.get('/getEnquiries', protect, roles('admin', 'superadmin'), getAllEnquiries);


export default router;