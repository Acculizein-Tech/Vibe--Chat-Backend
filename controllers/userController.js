// controllers/userController.js

import User from '../models/user.js';
import asyncHandler from '../utils/asyncHandler.js';

import Business from '../models/Business.js';
import Review from '../models/Review.js';
import { uploadToS3 } from '../middlewares/upload.js';

// @desc    Get current user details
// @route   GET /api/user/profile/:id
// @access  Private
//get the user By Id
export const getUserProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id).select('-password -refreshTokens');

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  res.status(200).json({
    status: 'success',
    data: user,
  });
});

// @desc    Update user profile
export const updateUserProfile = asyncHandler(async (req, res) => {
  try {
    const { fullName, email, phone, city, state, country, zipCode } = req.body;

    let avatarUrl = '';

    // Agar image bheji hai to S3 pr upload karo
    if (req.file) {
      const s3Url = await uploadToS3(req.file, req); // returns full URL
      avatarUrl = s3Url;
    }

    const updatedFields = {
      fullName, 
      email,
      phone,
      city,
      state,
      country,
      zipCode,
    };

     // ❌ Check for spaces in phone number
    if (phone && phone.includes(' ')) {
      return res.status(400).json({
        success: false,
        message: 'Phone number should not contain spaces. Please enter a valid phone number like +919876543210',
      });
    }

    // ✅ Allow + in the beginning of phone for country code
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    if (phone && !phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format. Please enter a valid number like +919876543210',
      });
    }

    if (avatarUrl) {
      updatedFields['profile'] = { avatar: avatarUrl };
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updatedFields },
      { new: true }
    );    

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: err.message,
    });
  }
});







export const getUserReviews = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;

  try {
    // 🔍 1. Get all businesses listed by the current user
    const businesses = await Business.find({ owner: ownerId }).select('_id name');

    if (!businesses.length) {
      return res.status(200).json({
        status: 'success',
        message: 'No businesses listed by this user yet.',
        reviews: [],
      });
    }

    const businessIds = businesses.map((b) => b._id);

    // 📝 2. Find all reviews on those businesses
    const reviews = await Review.find({ business: { $in: businessIds } })
      .populate('user', 'fullName profile.avatar') // reviewer info
      .populate('business', 'name')               // business info
      .sort({ createdAt: -1 })                    // latest first
      .lean();

    // 📦 3. Format the review response
    const formattedReviews = reviews.map((r) => ({
      reviewerName: r.user?.fullName || 'Anonymous',
      reviewerAvatar: r.user?.profile?.avatar || null,
      businessName: r.business?.name || 'Unknown',
      comment: r.comment,
      rating: r.rating,
      time: r.createdAt,
    }));

    return res.status(200).json({
      status: 'success',
      total: formattedReviews.length,
      reviews: formattedReviews,
    });

  } catch (error) {
    console.error('❌ Error while fetching reviews for user businesses:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while fetching business reviews.',
      error: error.message,
    });
  }
});


//get the business by use id
// export const getUserBusinesses = asyncHandler(async (req, res) => {
//   try {
//     const userId = req.user._id;

//     // Fetch businesses owned by this user
//     const businesses = await Business.find({ owner: userId })
//       .populate('owner', 'fullName profile.avatar') // Owner info
//       .sort({ createdAt: -1 });

//     if (!businesses.length) {
//       return res.status(404).json({
//         status: 'fail',
//         message: 'You have not listed any businesses yet.',
//         data: [],
//       });
//     }

//     return res.status(200).json({
//       status: 'success',
//       total: businesses.length,
//       businesses,
//     });

//   } catch (error) {
//     console.error('❌ Error while fetching user businesses:', error);

//     return res.status(500).json({
//       status: 'error',
//       message: 'Something went wrong while fetching your businesses.',
//       error: error.message,
//     });
//   }
// });

//better error handling
export const handleError = (error, res) => {  
  console.error('❌ Error:', error.message || error);
  res.status(500).json({
    status: 'error',
    message: 'An unexpected error occurred. Please try again later.',
    error: error.message || 'Unknown error',
  });
}


// @desc    Get all business listings created by the current user
// @route   GET /api/user/listings
// @access  Private
export const getUserListings = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  try {
    const listings = await Business.find({ owner: userId })
      .select('-__v') // optional: exclude Mongoose version key
      .populate('categoryRef') // optional: load category info if needed
      .sort({ createdAt: -1 }); // newest first

    if (!listings.length) {
      return res.status(200).json({
        status: 'success',
        message: 'No business listings found for this user.',
        listings: [],
      });
    }

    res.status(200).json({
      status: 'success',
      total: listings.length,
      listings,
    });
  } catch (error) {
    console.error('❌ Error fetching user listings:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch business listings.',
      error: error.message,
    });
  }
});



export const getAllSalesUsers = asyncHandler(async (req, res) => {
  try {
    const currentUserId = req.user?._id;

    const salesUsers = await User.find({
      role: 'sales',
      _id: { $ne: currentUserId } // Exclude current logged-in user
    })
      .select('-__v')
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      total: salesUsers.length,
      users: salesUsers,
    });
  } catch (error) {
    console.error('❌ Error fetching sales users:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch sales users.',
      error: error.message,
    });
  }
});


//get those users who have register with sales user refferal code link
export const getUsersByReferral = asyncHandler(async (req, res) => {
  try {
    // Ensure only sales users can access this
    if (req.user.role !== 'sales') {
      return res.status(403).json({
        message: 'Access denied. Only sales users can view referred users.'
      });
    }

    const referredUsers = await User.find({ referredBy: req.user._id })
      .select('-password -refreshTokens -__v') // Hide sensitive fields
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: 'success',
      total: referredUsers.length,
      users: referredUsers
    });

  } catch (error) {
    console.error('❌ Error fetching referred users:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server Error',
      error: error.message
    });
  }
});

