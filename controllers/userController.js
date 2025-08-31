// controllers/userController.js

import User from '../models/user.js';
import asyncHandler from '../utils/asyncHandler.js';

import Business from '../models/Business.js';
import Review from '../models/Review.js';
import { uploadToS3 } from '../middlewares/upload.js';
import Plan from '../models/Priceplan.js';
import Payment from '../models/Payment.js';
import axios from 'axios';
import KYC from '../models/KYC.js';

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

    // 🟢 User fetch karo
    const user = await User.findById(userId).select("wallet referralCode");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 🟢 Agar referralCode hi nahi hai
    if (!user.referralCode) {
      return res.status(200).json({
        success: true,
        wallet: user.wallet,
        referralCode: null,
        totalReferrals: 0,
      });
    }
     // 🟢 Fetch KYC status
    const kyc = await KYC.findOne({ userId }).select("isPaymentified");
    const isKycVerified = kyc?.isPaymentified === true;



    // 🟢 Count all Payment docs jaha referral.code == user.referralCode
    const totalReferrals = await Payment.countDocuments({
      "referral.code": user.referralCode,
      status: "success", // optional filter (sirf successful payments)
    });

    return res.status(200).json({
      success: true,
      wallet: user.wallet,              // { balance, history }
      referralCode: user.referralCode,  // unique referral code of user
      totalReferrals, 
      isPaymentified: isKycVerified,                  // count of how many times it was used
    });
  } catch (error) {
    console.error("❌ Error in getWalletInfo:", error);
    return res.status(500).json({
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
// export const redeemWallet = asyncHandler(async (req, res) => {
//   try {
//     const userId = req.user._id; // from auth middleware
//     const { amount, fund_account_id } = req.body; // fund_account_id = RazorpayX Fund Account (bank/UPI)

//     const user = await User.findById(userId);

//     if (!user) {
//       return res.status(404).json({ success: false, message: "User not found" });
//     }

//     // ✅ Check wallet balance
//     if (user.wallet.balance < 10) {
//       return res.status(400).json({
//         success: false,
//         message: "Minimum ₹10 balance required to redeem",
//       });
//     }

//     if (amount > user.wallet.balance) {
//       return res.status(400).json({
//         success: false,
//         message: "Insufficient wallet balance",
//       });
//     }

//     // ✅ Create Payout Request to RazorpayX
//     const payoutData = {
//       account_number: process.env.RAZORPAYX_ACCOUNT_NUMBER, // Virtual account no.
//       fund_account_id, // saved fund account of user (UPI/Bank)
//       amount: amount * 100, // in paise
//       currency: "INR",
//       mode: "UPI", // or "IMPS"/"NEFT"
//       purpose: "payout",
//       queue_if_low_balance: true,
//       reference_id: `redeem_${userId}_${Date.now()}`,
//       narration: "Wallet Redeem",
//     };

//     const payoutResponse = await razorpayX.post("/payouts", payoutData);

//     // ✅ Deduct balance & save transaction
//     user.wallet.balance -= amount;
//     user.wallet.history.push({
//       amount,
//       type: "debit",
//       description: "Wallet Redeem",
//       transactionId: payoutResponse.data.id,
//       createdAt: new Date(),
//     });

//     await user.save();

//     return res.status(200).json({
//       success: true,
//       message: "Redeem successful",
//       payout: payoutResponse.data,
//       balance: user.wallet.balance,
//     });
//   } catch (error) {
//     console.error("Redeem Error:", error.response?.data || error.message);

//     return res.status(500).json({
//       success: false,
//       message: "Redeem failed",
//       error: error.response?.data || error.message,
//     });
//   }
// });


//apply referal code


export const applyReferral = asyncHandler(async (req, res) => {
  try {
    const { referral_code, user_id, total_plan_amount } = req.body;

    // 🛑 Validation
    if (!referral_code || !user_id || !total_plan_amount) {
      return res.status(400).json({
        success: false,
        message: "Referral code, user_id and total_plan_amount are required",
      });
    }

    // 🎯 Step 1: Check if referral code exists in DB
    const referralProvider = await User.findOne({ referralCode: referral_code });
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

    // 🎯 Step 3: Just calculate referral bonus (do NOT update wallet here)
    const bonusAmount = 300;

    // 🎯 Step 4: Apply discount to current user's plan
    let updatedAmount = total_plan_amount - bonusAmount;
    if (updatedAmount < 0) updatedAmount = 0; // Prevent negative

    // 🎯 Step 5: Return updated amount and referral info (no wallet change)
    return res.status(200).json({
      success: true,
      message: "Referral applied successfully",
      updatedAmount,
      referralProvider: {
        id: referralProvider._id,
        name: referralProvider.fullName,
        referralCode: referralProvider.referralCode,
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
