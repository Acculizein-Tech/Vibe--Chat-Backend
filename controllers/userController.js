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

//edit the user

// @desc    Update user profile
// @route   POST /api/user/profile/:id
// @access  Private
// export const updateUserProfile = asyncHandler(async (req, res) => {
//   const { id } = req.params;

//   const allowedFields = ['fullName', 'email', 'username', 'city', 'state', 'country', 'zipCode'];
//   const updateData = {};

//   for (let key of allowedFields) {
//     if (req.body[key] !== undefined) {
//       updateData[key] = req.body[key];
//     }
//   }

//   // ✅ Handle nested profile fields
//   updateData.profile = {
//     name: req.body['profile.name'],
//     phone: req.body['profile.phone'],
//     photo: req.file ? `/uploads/others/${req.file.filename}` : undefined
//   };

//   // Remove undefined fields from profile
//   // Object.keys(updateData.profile).forEach(
//   //   (key) => updateData.profile[key] === undefined && delete updateData.profile[key]
//   // );

//   const updatedUser = await User.findByIdAndUpdate(id, updateData, {
//     new: true,
//     runValidators: true,
//   }).select('-password -refreshTokens');

//   if (!updatedUser) {
//     res.status(404);
//     throw new Error('User not found');
//   }

//   res.status(200).json({
//     status: 'success',
//     message: 'User updated successfully',
//     data: updatedUser,
//   });
// });

//update the password

export const updateUserProfile = asyncHandler(async (req, res) => {
  try {
    const { email, phone, zip } = req.body;

    let avatarUrl = '';

    // Agar image bheji hai to S3 pr upload karo
    if (req.file) {
      const s3Url = await uploadToS3(req.file, req); // returns full URL
      avatarUrl = s3Url;
    }

    const updatedFields = {
      email,
      phone,
      zip,
    };

    if (avatarUrl) {
      updatedFields['profile.avatar'] = avatarUrl;
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




// User uploads their profile image
// router.post('/upload-profile', upload.single('profileImage'), async (req, res) => {
//   try {
//     const userId = req.user.id; // assuming auth middleware is used
//     const profileImage = req.file?.path;

//     if (!profileImage) {
//       return res.status(400).json({ error: 'No image uploaded' });
//     }

//     const user = await User.findByIdAndUpdate(
//       userId,
//       { profileImage },
//       { new: true }
//     );

//     res.json({ message: 'Profile image updated', user });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });


//get all reviews by user
// export const getUserReviews = asyncHandler(async (req, res) => {
//   try {
//     const ownerId = req.user._id;

//     // 🔍 Step 1: Get all businesses created by this user
//     const businesses = await Business.find({ owner: ownerId }).select('_id');

//     if (!businesses.length) {
//       return res.status(404).json({
//         status: 'fail',
//         message: 'You have not listed any businesses yet.',
//         data: [],
//       });
//     }

//     const businessIds = businesses.map((b) => b._id);

//     // 📥 Step 2: Fetch reviews for these business IDs
//     const reviews = await Review.find({ business: { $in: businessIds } })
//       .populate('user', 'fullName profile.avatar') // Reviewer info
//       .populate('business', 'name')               // Business name
//       .sort({ createdAt: -1 });

//     // 🎁 Step 3: Format reviews neatly
//     const formatted = reviews.map((r) => ({
//       reviewerName: r.user?.fullName,
//       reviewerAvatar: r.user?.profile?.avatar || null,
//       businessName: r.business?.name,
//       comment: r.comment,
//       rating: r.rating,
//       time: r.createdAt,
//     }));

//     return res.status(200).json({
//       status: 'success',
//       total: formatted.length,
//       reviews: formatted,
//     });

//   } catch (error) {
//     console.error('❌ Error while fetching user reviews:', error);

//     return res.status(500).json({
//       status: 'error',
//       message: 'Something went wrong while fetching your business reviews.',
//       error: error.message,
//     });
//   }
// });
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


//edit business listing by id check the businessController.js put api


//get the all sales user or user whose role is sales
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

