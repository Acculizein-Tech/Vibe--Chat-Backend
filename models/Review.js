// models/Review.js
import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
});

// reviewSchema.index({ business: 1, user: 1 }, { unique: true }); // 🚫 Prevent multiple reviews from same user

const Review = mongoose.model('Review', reviewSchema);
export default Review;
