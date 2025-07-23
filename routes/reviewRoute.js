import express from 'express';
import {
  createReview,
  updateReview,
  deleteReview,
  getBusinessReviews,
  getAllReviews
} from '../controllers/reviewController.js';
import { protect } from '../middlewares/auth.js';
import  roles  from '../middlewares/roles.js';

const router = express.Router();

// POST /api/reviews/:businessId
router.post('/:businessId', protect, createReview);

// PUT /api/reviews/:reviewId
router.put('/:reviewId', protect, updateReview);

// DELETE /api/reviews/:reviewId
router.delete('/:reviewId', protect, deleteReview);

router.get('/getreviewdata', protect, roles('superadmin'), getAllReviews);
// GET /api/reviews/:businessId
router.get('/:businessId', getBusinessReviews);


export default router;
