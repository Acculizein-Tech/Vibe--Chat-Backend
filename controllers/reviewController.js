import Review from '../models/Review.js';
import Business from '../models/Business.js';
import asyncHandler from '../utils/asyncHandler.js';
import { updateBusinessRating } from '../utils/calculateAverageRating.js';
import { notifyUser, notifyRole } from '../utils/sendNotification.js'; // ✅ Import the utility



//create review with notification
// ⭐ Create Review
// export const createReview = async (req, res) => {
//   try {
//     const { businessId } = req.params;
//     const { rating, comment } = req.body;

//     if (!rating && !comment) {
//       return res.status(400).json({ message: 'Rating or comment is required' });
//     }

//     // 🔍 Validate business
//     const business = await Business.findById(businessId).populate('owner', 'fullName email');
//     if (!business) {
//       return res.status(404).json({ message: 'Business not found' });
//     }

//     // 📝 Create review
//     const review = new Review({
//       user: req.user._id,
//       business: businessId,
//       rating: rating || undefined,
//       comment: comment || ''
//     });
//     await review.save();

//     // 🔁 Update average rating
//     await updateBusinessRating(businessId);

//     // 🔔 Notify business owner
//     // 🔔 Notify business owner
// if (business.owner?._id) {
//   await notifyUser({
//     userId: business.owner._id,
//     type: 'REVIEW_RECEIVED',
//     title: '📢 New Review Received',
//     message: `${req.user.fullName} left a review on your business "${business.name}".`,
//     data: {
//       businessId,
//       rating,
//       comment,
//       reviewerId: req.user._id,
//       redirectPath: `/business/${businessId}/reviews` // ✅ Added for frontend routing
//     }
//   });
// }

// // 🔔 Notify admin and superadmin
// await Promise.all([
//   notifyRole({
//     role: 'admin',
//     type: 'REVIEW_RECEIVED',
//     title: '📝 Business Received Review',
//     message: `"${business.name}" just received a review from ${req.user.fullName}.`,
//     data: {
//       businessId,
//       rating,
//       comment,
//       reviewerId: req.user._id,
//       redirectPath: `/admin/business/${businessId}/reviews` // ✅ For admin view
//     }
//   }),
//   notifyRole({
//     role: 'superadmin',
//     type: 'REVIEW_RECEIVED',
//     title: '📝 Business Received Review',
//     message: `"${business.name}" just received a review from ${req.user.fullName}.`,
//     data: {
//       businessId,
//       rating,
//       comment,
//       reviewerId: req.user._id,
//       redirectPath: `/superadmin/business/${businessId}/reviews` // ✅ For superadmin view
//     }
//   })
// ]);


//     res.status(201).json({
//       message: 'Review submitted successfully',
//       review
//     });

//   } catch (error) {
//     console.error('❌ Error creating review:', error);
//     res.status(500).json({ message: 'Server Error', error: error.message });
//   }
// };

// ⭐ Create Review
export const createReview = async (req, res) => {
  try {
    const { businessId } = req.params;
    const { rating, comment } = req.body;

    if (!rating && !comment) {
      return res.status(400).json({ message: 'Rating or comment is required' });
    }

    // 🔍 Validate business
    const business = await Business.findById(businessId).populate('owner', 'fullName email role');
    if (!business) {
      return res.status(404).json({ message: 'Business not found' });
    }

    // 📝 Create review
    const review = new Review({
      user: req.user._id,
      business: businessId,
      rating: rating || undefined,
      comment: comment || ''
    });
    await review.save();

    // 🔁 Update average rating
    await updateBusinessRating(businessId);

    // 🔔 Notify business owner (but NOT if reviewer is owner)
    if (business.owner?._id.toString() !== req.user._id.toString()) {
      await notifyUser({
        userId: business.owner._id,
        type: 'REVIEW_RECEIVED',
        title: '📢 New Review Received',
        message: `${req.user.fullName} left a review on your business "${business.name}".`,
        data: {
          businessId,
          rating,
          comment,
          reviewerId: req.user._id,
          redirectPath: `/business/${businessId}/reviews`
        }
      });
    }

    // 🔔 Notify admin + superadmin (skip if owner already has same role)
    const notifyRoles = [];
    if (business.owner?.role !== 'admin') {
      notifyRoles.push(
        notifyRole({
          role: 'admin',
          type: 'REVIEW_RECEIVED',
          title: '📝 Business Received Review',
          message: `"${business.name}" just received a review from ${req.user.fullName}.`,
          data: {
            businessId,
            rating,
            comment,
            reviewerId: req.user._id,
            redirectPath: `/admin/business/${businessId}/reviews`
          }
        })
      );
    }

    if (business.owner?.role !== 'superadmin') {
      notifyRoles.push(
        notifyRole({
          role: 'superadmin',
          type: 'REVIEW_RECEIVED',
          title: '📝 Business Received Review',
          message: `"${business.name}" just received a review from ${req.user.fullName}.`,
          data: {
            businessId,
            rating,
            comment,
            reviewerId: req.user._id,
            redirectPath: `/superadmin/business/${businessId}/reviews`
          }
        })
      );
    }

    await Promise.all(notifyRoles);

    res.status(201).json({
      message: 'Review submitted successfully',
      review
    });

  } catch (error) {
    console.error('❌ Error creating review:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};



// ✏️ Update Review
export const updateReview = async (req, res) => {
  const { reviewId } = req.params;
  const { rating, comment } = req.body;

  const review = await Review.findById(reviewId);
  if (!review) return res.status(404).json({ message: 'Review not found' });

  if (!review.user.equals(req.user._id)) {
    return res.status(403).json({ message: 'You are not authorized' });
  }

  review.rating = rating;
  review.comment = comment;

  await review.save();

  // 🔁 Update ratings
  await updateBusinessRating(review.business);

  res.json({ message: 'Review updated', review });
};


// 🗑️ Delete Review
export const deleteReview = async (req, res) => {
  const { reviewId } = req.params;

  const review = await Review.findById(reviewId);
  if (!review) return res.status(404).json({ message: 'Review not found' });

  if (!review.user.equals(req.user._id)) {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  const businessId = review.business;

 await Review.findByIdAndDelete(reviewId);


  // 🔁 Update ratings
  await updateBusinessRating(businessId);

  res.json({ message: 'Review deleted' });
};

// 📋 Get All Reviews for a Business
export const getBusinessReviews = asyncHandler(async (req, res) => {
  const { businessId } = req.params;

  // ✅ Validate input
  if (!businessId) {
    res.status(400);
    throw new Error('Business ID is required');
  }

  try {
    // ✅ Fetch all reviews for the business
    const reviews = await Review.find({ business: businessId })
      .populate('user', 'fullName profile.avatar') // Only necessary user fields
      .sort({ createdAt: -1 }); // Newest first

    // ✅ Respond
    res.status(200).json({
      status: 'success',
      total: reviews.length,
      reviews,
    });
  } catch (error) {
    console.error(`❌ Failed to get reviews for business ${businessId}:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch business reviews',
      error: error.message,
    });
  }
});

//get all reviews data
export const getAllReviews = asyncHandler(async (req, res) => {
  try {
    const reviews = await Review.find({})
      .populate('user', 'fullName profile.avatar')
      .lean();

    const formattedReviews = reviews.map(({ business, user, ...rest }) => ({
      ...rest,
      businessId: business?.toString() || null, // renamed field
      userName: user?.fullName || null,
      avatar: user?.profile?.avatar || null,
    }));

    res.status(200).json({
      status: 'success',
      totalReviews: formattedReviews.length,
      reviews: formattedReviews,
    });
  } catch (error) {
    console.error('❌ Failed to fetch reviews:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch all reviews',
      error: error.message,
    });
  }
});



// 💬 Reply to a Review
// 💬 Reply to a Review (with populated user info)
export const replyToReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { comment } = req.body;

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ message: 'Reply comment is required' });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const reply = {
      user: req.user._id,
      comment
    };

    review.replies.push(reply);
    await review.save();

    // 🔁 Refetch review with populated reply users
    const populatedReview = await Review.findById(reviewId).populate(
      'replies.user',
      'fullName profile.avatar'
    );

    const formattedReplies = populatedReview.replies.map(r => ({
      _id: r._id,
      comment: r.comment,
      createdAt: r.createdAt,
      user: {
        _id: r.user._id,
        fullName: r.user.fullName,
        avatar: r.user.profile?.avatar || null
      }
    }));

    res.status(201).json({
      message: 'Reply added successfully',
      replies: formattedReplies
    });
  } catch (error) {
    console.error('❌ Error replying to review:', error);
    res.status(500).json({
      error: 'Server Error',
      message: error.message
    });
  }
};

