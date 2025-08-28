// controllers/userController.js

import User from '../models/user.js';
import asyncHandler from '../utils/asyncHandler.js';

import Business from '../models/Business.js';
import Review from '../models/Review.js';
import { uploadToS3 } from '../middlewares/upload.js';
import Plan from '../models/Priceplan.js';
import axios from 'axios';

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
// export const updateUserProfile = asyncHandler(async (req, res) => {
//   try {
//     const { fullName, email, phone, city, state, country, zipCode } = req.body;

//     let avatarUrl = '';

//     // Agar image bheji hai to S3 pr upload karo
//     if (req.file) {
//       const s3Url = await uploadToS3(req.file, req); // returns full URL
//       avatarUrl = s3Url;
//     }

//     const updatedFields = {
//       fullName, 
//       email,
//       phone,
//       city,
//       state,
//       country,
//       zipCode,
//     };

//      // ❌ Check for spaces in phone number
//     if (phone && phone.includes(' ')) {
//       return res.status(400).json({
//         success: false,
//         message: 'Phone number should not contain spaces. Please enter a valid phone number like +919876543210',
//       });
//     }

//     // ✅ Allow + in the beginning of phone for country code
//     const phoneRegex = /^\+?[0-9]{10,15}$/;
//     if (phone && !phoneRegex.test(phone)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid phone number format. Please enter a valid number like +919876543210',
//       });
//     }

//     // if (avatarUrl) {
//     //   updatedFields['profile'] = { avatar: avatarUrl };
//     // }
//     if (avatarUrl) {
//   updatedFields['profile.avatar'] = avatarUrl; // sirf avatar field update karega
// }

//     const updatedUser = await User.findByIdAndUpdate(
//       req.params.id,
//       { $set: updatedFields },
//       { new: true }
//     );    

//     res.status(200).json({
//       success: true,
//       message: 'Profile updated successfully',
//       data: updatedUser,
//     });
//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: 'Failed to update profile',
//       error: err.message,
//     });
//   }
// });

// export const updateUserProfile = asyncHandler(async (req, res) => {
//   try {
//     const { fullName, email, phone, city, state, country, zipCode } = req.body;

//     // ✅ Validation: Phone number space check
//     if (phone && phone.includes(' ')) {
//       return res.status(400).json({
//         success: false,
//         message: 'Phone number should not contain spaces. Example: +919876543210',
//       });
//     }

//     // ✅ Validation: Allow + in beginning & length 10-15
//     const phoneRegex = /^\+?[0-9]{10,15}$/;
//     if (phone && !phoneRegex.test(phone)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid phone number. Example: +919876543210',
//       });
//     }

//     // ✅ Prepare updated fields
//     const updatedFields = {
//       fullName: fullName?.trim(),
//       email: email?.trim(),
//       phone,
//       city: city?.trim(),
//       state: state?.trim(),
//       country: country?.trim(),
//       zipCode: zipCode?.trim(),
//     };

//     // ✅ Agar avatar file aayi hai to S3 pr upload
//     // if (req.file) {
//     //   const s3Url = await uploadToS3(req.file, req);
//     //   updatedFields["profile.avatar"] = s3Url; // ✅ Dot notation se nested field update
//     // }
//     if (req.file) {
//   const s3Result = await uploadToS3(req.file, req);
//   updatedFields["profile.avatar"] = s3Result.url; // only string, no object
// }


//     // ✅ Update & return latest user
//     const updatedUser = await User.findByIdAndUpdate(
//       req.params.id,
//       { $set: updatedFields },
//       { new: true, runValidators: true }
//     );

//     if (!updatedUser) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found',
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: 'Profile updated successfully',
//       data: updatedUser,
//     });

//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: 'Failed to update profile',
//       error: err.message,
//     });
//   }
// });

export const updateUserProfile = asyncHandler(async (req, res) => {
  try {
    const { fullName, email, phone, city, state, country, zipCode } = req.body;

    // ✅ Phone number space check
    if (phone && phone.includes(' ')) {
      return res.status(400).json({
        success: false,
        message: 'Phone number should not contain spaces. Example: +919876543210',
      });
    }

    // ✅ Phone number format check
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    if (phone && !phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number. Example: +919876543210',
      });
    }

    // ✅ Prepare updated fields (without avatar for now)
    const updatedFields = {
      fullName: fullName?.trim(),
      email: email?.trim(),
      phone,
      city: city?.trim(),
      state: state?.trim(),
      country: country?.trim(),
      zipCode: zipCode?.trim(),
    };

       // ✅ Handle avatar upload in background (non-blocking)
    if (req.file) {
      try {
        const s3Result = await uploadToS3(req.file, req);
        await User.findByIdAndUpdate(
          req.params.id,
          { $set: { "profile.avatar": s3Result.url } },
          { new: true }
        );
      } catch (uploadErr) {
        console.error("S3 upload failed:", uploadErr.message);
      }
    }

    // ✅ Update user immediately in DB
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updatedFields },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // ✅ Respond to client immediately (within 1–2 sec)
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



//get the userRefferal by user.
export const getWalletInfo = async (req, res) => {
  try {
    const userId = req.user.id; // auth middleware se aayega

    const user = await User.findById(userId).select("wallet referralCode");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      wallet: user.wallet,         // { balance, history }
      referralCode: user.referralCode, // sirf referral code
    });
  } catch (error) {
    console.error("❌ Error in getWalletInfo:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


//redeem referral code
const razorpayX = axios.create({
  baseURL: "https://api.razorpay.com/v1",
  auth: {
    username: process.env.RAZORPAY_KEY_ID,
    password: process.env.RAZORPAY_KEY_SECRET,
  },
});

/**
 * Redeem Wallet Balance (Min ₹10)
 */
export const redeemWallet = asyncHandler(async (req, res) => {
  try {
    const userId = req.user._id; // from auth middleware
    const { amount, fund_account_id } = req.body; // fund_account_id = RazorpayX Fund Account (bank/UPI)

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // ✅ Check wallet balance
    if (user.wallet.balance < 10) {
      return res.status(400).json({
        success: false,
        message: "Minimum ₹10 balance required to redeem",
      });
    }

    if (amount > user.wallet.balance) {
      return res.status(400).json({
        success: false,
        message: "Insufficient wallet balance",
      });
    }

    // ✅ Create Payout Request to RazorpayX
    const payoutData = {
      account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER, // Virtual account no.
      fund_account_id, // saved fund account of user (UPI/Bank)
      amount: amount * 100, // in paise
      currency: "INR",
      mode: "UPI", // or "IMPS"/"NEFT"
      purpose: "payout",
      queue_if_low_balance: true,
      reference_id: `redeem_${userId}_${Date.now()}`,
      narration: "Wallet Redeem",
    };

    const payoutResponse = await razorpayX.post("/payouts", payoutData);

    // ✅ Deduct balance & save transaction
    user.wallet.balance -= amount;
    user.wallet.history.push({
      amount,
      type: "debit",
      description: "Wallet Redeem",
      transactionId: payoutResponse.data.id,
      createdAt: new Date(),
    });

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Redeem successful",
      payout: payoutResponse.data,
      balance: user.wallet.balance,
    });
  } catch (error) {
    console.error("Redeem Error:", error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      message: "Redeem failed",
      error: error.response?.data || error.message,
    });
  }
});


//apply referal code
export const applyReferral = asyncHandler(async (req, res) => {
  try {
    const { refferal_code, user_id, actual_amount } = req.body;

    // 🛑 Validation
    if (!refferal_code || !user_id || !actual_amount) {
      return res.status(400).json({
        success: false,
        message: "Referral code, user_id and actual_amount are required",
      });
    }

    // 🎯 Step 1: Check if referral code exists in DB
    const referralProvider = await User.findOne({ referralCode: refferal_code });
    if (!referralProvider) {
      return res.status(404).json({
        success: false,
        message: "Invalid referral code",
      });
    }

    // 🎯 Step 2: Ensure user is not using own referral code
    if (referralProvider._id.toString() === user_id) {
      return res.status(400).json({
        success: false,
        message: "You cannot use your own referral code",
      });
    }

    // 🎯 Step 3: Apply discount
    let updatedAmount = actual_amount - 300;
    if (updatedAmount < 0) updatedAmount = 0; // Prevent negative

    // 🎯 Step 4: Return updated amount
    return res.status(200).json({
      success: true,
      message: "Referral applied successfully",
      updatedAmount,
      referralProvider: {
        id: referralProvider._id,
        name: referralProvider.fullName,
      },
    });
  } catch (error) {
    console.error("Error in applyReferral:", error);
    res.status(500).json({
      success: false,
      message: "Server error applying referral",
    });
  }
});

// export const applyReferral = asyncHandler(async (req, res) => {
//   try {
//     const { referralCode, userId, business } = req.body;

//     // 🛑 Validation
//     if (!referralCode || !userId || !business?.plan || !business?.location?.state) {
//       return res.status(400).json({
//         success: false,
//         message: "Referral code, userId, plan and state are required",
//       });
//     }

//     // 🎯 Step 1: Check if referral code exists
//     const referralProvider = await User.findOne({ referralCode });
//     if (!referralProvider) {
//       return res.status(404).json({
//         success: false,
//         message: "Invalid referral code",
//       });
//     }

//     // 🎯 Step 2: Prevent self-referral
//     if (referralProvider._id.toString() === userId) {
//       return res.status(400).json({
//         success: false,
//         message: "You cannot use your own referral code",
//       });
//     }

//     // 🎯 Step 3: Get plan price from DB
//     const plan = await Plan.findById(business.plan);
//     if (!plan) {
//       return res.status(404).json({
//         success: false,
//         message: "Plan not found",
//       });
//     }

//     let totalAmount = plan.price; // ✅ Plan price (GST included)
//     let updatedAmount = totalAmount - 300;
//     if (updatedAmount < 0) updatedAmount = 0;

//     // 🎯 Step 4: Recompute GST split
//     const baseAmount = parseFloat((updatedAmount / 1.18).toFixed(2));
//     const gstAmount = parseFloat((updatedAmount - baseAmount).toFixed(2));

//     const buyerState = (business?.location?.state || "").trim().toLowerCase();
//     const isUP = buyerState === "uttar pradesh";

//     let cgst = 0, sgst = 0, igst = 0;
//     if (isUP) {
//       const halfGST = gstAmount / 2;
//       cgst = parseFloat(halfGST.toFixed(2));
//       sgst = parseFloat((gstAmount - cgst).toFixed(2));
//     } else {
//       igst = gstAmount;
//     }

//     // 🎯 Step 5: Return updated amount with GST details
//     return res.status(200).json({
//       success: true,
//       message: "Referral applied successfully",
//       updatedAmount,
//       baseAmount,
//       tax: { cgst, sgst, igst },
//       referralProvider: {
//         id: referralProvider._id,
//         name: referralProvider.fullName,
//       },
//     });
//   } catch (error) {
//     console.error("Error in applyReferral:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error applying referral",
//     });
//   }
// });