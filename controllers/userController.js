// controllers/userController.js

import User from "../models/user.js";
import asyncHandler from "../utils/asyncHandler.js";

// import Business from "../models/Business.js";
// import Review from "../models/Review.js";
import { uploadToS3 } from "../middlewares/upload.js";
// import Plan from "../models/Priceplan.js";
// import Payment from "../models/Payment.js";
import axios from "axios";
// import KYC from "../models/KYC.js";
// import Priceplan from "../models/Priceplan.js";

import { generateNameBasedCode } from "../utils/generateReferralCode.js";

// @desc    Get current user details
// @route   GET /api/user/profile/:id
// @access  Private
//get the user By Id
export const getUserProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id).select("-password -refreshTokens");

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  res.status(200).json({
    status: "success",
    data: user,
  });
});

// @desc    Update user profile

export const updateUserProfile = asyncHandler(async (req, res) => {
  try {
    const { fullName, email, phone, city, state, country, zipCode } = req.body;

    // ✅ Phone number space check
    if (phone && phone.includes(" ")) {
      return res.status(400).json({
        success: false,
        message:
          "Phone number should not contain spaces. Example: +919876543210",
      });
    }

    // ✅ Phone number format check
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    if (phone && !phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number. Example: +919876543210",
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
        message: "User not found",
      });
    }

    // ✅ Respond to client immediately (within 1–2 sec)
    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: err.message,
    });
  }
});

export const getUserReviews = asyncHandler(async (req, res) => {
  const ownerId = req.user._id;

  try {
    // 🔍 1. Get all businesses listed by the current user
    const businesses = await Business.find({ owner: ownerId }).select(
      "_id name"
    );

    if (!businesses.length) {
      return res.status(200).json({
        status: "success",
        message: "No businesses listed by this user yet.",
        reviews: [],
      });
    }

    const businessIds = businesses.map((b) => b._id);

    // 📝 2. Find all reviews on those businesses
    const reviews = await Review.find({ business: { $in: businessIds } })
      .populate("user", "fullName profile.avatar") // reviewer info
      .populate("business", "name") // business info
      .sort({ createdAt: -1 }) // latest first
      .lean();

    // 📦 3. Format the review response
    const formattedReviews = reviews.map((r) => ({
      reviewerName: r.user?.fullName || "Anonymous",
      reviewerAvatar: r.user?.profile?.avatar || null,
      businessName: r.business?.name || "Unknown",
      comment: r.comment,
      rating: r.rating,
      time: r.createdAt,
    }));

    return res.status(200).json({
      status: "success",
      total: formattedReviews.length,
      reviews: formattedReviews,
    });
  } catch (error) {
    console.error(
      "❌ Error while fetching reviews for user businesses:",
      error
    );
    return res.status(500).json({
      status: "error",
      message: "Server error while fetching business reviews.",
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
  console.error("❌ Error:", error.message || error);
  res.status(500).json({
    status: "error",
    message: "An unexpected error occurred. Please try again later.",
    error: error.message || "Unknown error",
  });
};

// @desc    Get all business listings created by the current user
// @route   GET /api/user/listings
// @access  Private
// export const getUserListings = asyncHandler(async (req, res) => {
//   const userId = req.user._id;

//   try {
//     const listings = await Business.find({
//       owner: userId,
//       deleteBusiness: false,
//     })
//       .select("-__v") // optional: exclude Mongoose version key
//       .populate("categoryRef") // optional: load category info if needed
//       .sort({ createdAt: -1 }); // newest first

//     if (!listings.length) {
//       return res.status(200).json({
//         status: "success",
//         message: "No business listings found for this user.",
//         listings: [],
//       });
//     }

//     res.status(200).json({
//       status: "success",
//       total: listings.length,
//       listings,
//     });
//   } catch (error) {
//     console.error("❌ Error fetching user listings:", error);
//     res.status(500).json({
//       status: "error",
//       message: "Failed to fetch business listings.",
//       error: error.message,
//     });
//   }
// });

export const getUserListings = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  try {
    const listings = await Business.find({
      owner: userId,
      deleteBusiness: false,
    })
      .select("-__v")
      .populate("categoryRef")
      .sort({ createdAt: -1 });

    if (!listings.length) {
      return res.status(200).json({
        status: "success",
        message: "No business listings found for this user.",
        listings: [],
      });
    }

    // 🔄 transform categoryRef -> categoryData (skip _id inside)
    const transformedListings = listings.map((listing) => {
      const obj = listing.toObject();
      if (obj.categoryRef) {
        obj.categoryData = obj.categoryRef.toObject ? obj.categoryRef.toObject() : obj.categoryRef;
        delete obj.categoryData._id;   // 🚫 remove inner _id
        delete obj.categoryRef;        // remove old key
      }
      return obj;
    });

    res.status(200).json({
      status: "success",
      total: transformedListings.length,
      listings: transformedListings,
    });
  } catch (error) {
    console.error("❌ Error fetching user listings:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch business listings.",
      error: error.message,
    });
  }
});



export const getAllSalesUsers = asyncHandler(async (req, res) => {
  try {
    const currentUserId = req.user?._id;

    const salesUsers = await User.find({
      role: "sales",
      _id: { $ne: currentUserId }, // Exclude current logged-in user
    })
      .select("-__v")
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      total: salesUsers.length,
      users: salesUsers,
    });
  } catch (error) {
    console.error("❌ Error fetching sales users:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch sales users.",
      error: error.message,
    });
  }
});

//get those users who have register with sales user refferal code link
export const getUsersByReferral = asyncHandler(async (req, res) => {
  try {
    // Ensure only sales users can access this
    if (req.user.role !== "sales") {
      return res.status(403).json({
        message: "Access denied. Only sales users can view referred users.",
      });
    }

    const referredUsers = await User.find({ referredBy: req.user._id })
      .select("-password -refreshTokens -__v") // Hide sensitive fields
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      total: referredUsers.length,
      users: referredUsers,
    });
  } catch (error) {
    console.error("❌ Error fetching referred users:", error);
    res.status(500).json({
      status: "error",
      message: "Server Error",
      error: error.message,
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
      wallet: user.wallet, // { balance, history }
      referralCode: user.referralCode, // unique referral code of user
      totalReferrals,
      isPaymentified: isKycVerified, // count of how many times it was used
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



export const applyReferral = asyncHandler(async (req, res) => {
  try {
    const { referral_code, user_id, total_plan_amount, plan_id } = req.body;

    if (!referral_code || !user_id || !total_plan_amount) {
      return res.status(400).json({
        success: false,
        message: "Referral code, user_id and total_plan_amount are required",
      });
    }

    // --- Step 1: Superadmin referral (same as before) ---
    // --- Step 1: Superadmin referral (case-insensitive) ---
let superAdmin = await User.findOne({
  role: "superadmin",
  // 🔹 Case-insensitive match using regex
  "customCodes.generatedCode": { $regex: `^${referral_code.trim()}$`, $options: "i" }
});

if (superAdmin) {
  const customCode = superAdmin.customCodes.find(
    // 🔹 Direct exact match, case-insensitive not needed here as query already matched
    (c) => c.generatedCode === referral_code.trim() && c.isActive
  );

  if (!customCode)
    return res.status(404).json({ message: "Invalid or inactive code" });

  if (customCode.validity && new Date() > customCode.validity) {
    return res.status(400).json({ message: "Referral code expired" });
  }

  let updatedAmount = total_plan_amount - customCode.codeValue;
  if (updatedAmount < 0) updatedAmount = 0;

  return res.status(200).json({
    success: true,
    message: "Referral code applied successfully",
    updatedAmount,
    appliedCode: {
      codeName: customCode.codeName,
      codeValue: customCode.codeValue,
      generatedCode: customCode.generatedCode,
      validity: customCode.validity,
    },
  });
}


    // --- Step 2: User referral with commission ---
    const referralProvider = await User.findOne({ referralCode: referral_code.trim() });
    if (!referralProvider) {
      return res.status(404).json({ success: false, message: "Invalid referral code" });
    }

    if (referralProvider._id.toString() === user_id) {
      return res.status(400).json({ success: false, message: "You cannot use your own referral code" });
    }

    // ✅ Fetch plan commission
    const plan = plan_id ? await Priceplan.findById(plan_id) : await Priceplan.findOne({ price: total_plan_amount });
    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }

    const commission = plan.commission || 0;

    let updatedAmount = total_plan_amount - commission;
    if (updatedAmount < 0) updatedAmount = 0;

    return res.status(200).json({
      success: true,
      message: "Referral code applied successfully",
      updatedAmount,
      referralProvider: {
        id: referralProvider._id,
        name: referralProvider.fullName,
        referralCode: referralProvider.referralCode,
      },
      commissionApplied: commission
    });

  } catch (error) {
    console.error("Error in applyReferral:", error);
    res.status(500).json({
      success: false,
      message: "Server error applying referral",
    });
  }
});



export const createCustomCode = async (req, res) => {
  try {
    const { codename, amount, validity } = req.body;

    // ✅ Only superadmin allowed
    if (!req.user || req.user.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "❌ Only superadmin can generate codes",
      });
    }

    // ✅ Validation
    if (!codename || !amount) {
      return res.status(400).json({
        success: false,
        message: "❌ Code name and flat discount amount required",
      });
    }

    if (typeof codename !== "string" || codename.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "❌ Codename must be a valid string with at least 2 characters",
      });
    }

     // 🚫 Allow only alphanumeric (no spaces, no underscores, no special chars)
    if (!/^[A-Za-z0-9]+$/.test(codename)) {
      return res.status(400).json({
        success: false,
        message:
          "❌ Code name must only contain letters and numbers (no spaces or special characters).",
      });
    }

    // ✅ Find superadmin
    const superAdmin = await User.findById(req.user._id);
    if (!superAdmin) {
      return res.status(404).json({
        success: false,
        message: "❌ Superadmin not found",
      });
    }

    // ✅ Generated code = same as codename
    const generatedCode = codename;

    // ✅ Check duplicate
    const exists = superAdmin.customCodes.some(
      (c) => c.generatedCode === generatedCode
    );
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "❌ Code already exists, please choose another name",
      });
    }

    const newCode = {
      codeName: codename,
      codeValue: amount,
      validity: validity ? new Date(validity) : null,
      generatedCode,
      isActive: true,
    };

    superAdmin.customCodes.push(newCode);
    await superAdmin.save();

    return res.status(201).json({
      success: true,
      message: `✅ Custom code "${generatedCode}" generated successfully`,
      customCode: newCode,
    });
  } catch (error) {
    console.error("Error in createCustomCode:", error);
    return res.status(500).json({
      success: false,
      message: "❌ Server error generating code",
    });
  }
};







// ✅ Get custom codes for superadmin (production ready)
export const getCustomCodes = async (req, res) => {
  try {
    // 🛑 Ensure user is superadmin
    if (!req.user || req.user.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "Only superadmin can access custom codes",
      });
    }

    // ✅ Fetch superadmin from DB
    const superAdmin = await User.findById(req.user._id).lean().sort({ createdAt: -1 });
    if (!superAdmin) {
      return res.status(404).json({
        success: false,
        message: "Superadmin not found",
      });
    }

    // ✅ Filter only safe fields from customCodes
    const safeCustomCodes = superAdmin.customCodes.map((code) => ({
      _id: code._id,
      codeName: code.codeName,
      codeValue: code.codeValue,
      validity: code.validity ? new Date(code.validity).toISOString().split("T")[0] : null, // ✅ only date,
      generatedCode: code.generatedCode,
      isActive: code.isActive,
      createdAt: code.createdAt,
    }));

    return res.status(200).json({
      success: true,
      customCodes: safeCustomCodes,
    });
  } catch (error) {
    console.error("Error in getCustomCodes:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching custom codes",
    });
  }
};

 
// Delete Custom Code
export const DeleteCustomCode = async (req, res) => {
  try {
    const { id } = req.body;

    // ✅ Check if user is superadmin
    if (!req.user || req.user.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "❌ Only superadmin can delete codes",
      });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "❌ id is required to delete custom code",
      });
    }

    // ✅ Delete code by _id
    const result = await User.updateOne(
      { _id: req.user._id },
      { $pull: { customCodes: { _id: id } } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "❌ Custom code not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "✅ Custom code deleted successfully",
    });

  } catch (error) {
    console.error("Error in DeleteCustomCode:", error);
    return res.status(500).json({
      success: false,
      message: "❌ Server error while deleting custom code",
    });
  }
};


export const UpdateCustomCode = async (req, res) => {
  try {
    const { id, codeName, codeValue, validity, isActive } = req.body;

    // ✅ Superadmin check
    if (!req.user || req.user.role !== "superadmin") {
      return res.status(403).json({
        success: false,
        message: "❌ Only superadmin can update custom codes",
      });
    }

    if (!id || !codeName) {
      return res.status(400).json({
        success: false,
        message: "❌ id and codeName are required",
      });
    }

    // ✅ Find superadmin
    const superAdmin = await User.findById(req.user._id);
    if (!superAdmin) {
      return res.status(404).json({
        success: false,
        message: "❌ Superadmin not found",
      });
    }

    // ✅ Find code by unique _id
    const code = superAdmin.customCodes.id(id); // mongoose built-in method
    if (!code) {
      return res.status(404).json({
        success: false,
        message: "❌ Custom code not found",
      });
    }

    // ✅ Update codeName & generatedCode
    code.codeName = codeName;
    code.generatedCode = codeName;

    // ✅ Optional fields
    if (codeValue !== undefined) code.codeValue = codeValue;
    if (validity !== undefined) code.validity = new Date(validity);
    if (isActive !== undefined) code.isActive = isActive;

    await superAdmin.save();

    return res.status(200).json({
      success: true,
      message: "✅ Custom code updated successfully",
      updatedCode: code,
    });

  } catch (error) {
    console.error("Error in UpdateCustomCode:", error);
    return res.status(500).json({
      success: false,
      message: "❌ Server error while updating custom code",
    });
  }
};



// ✅ Block a user
export const blockUser = async (req, res) => {
  try {
    const { userId, blockedUserId } = req.body;

    // Prevent blocking self
    if (userId === blockedUserId) {
      return res.status(400).json({ message: "You cannot block yourself." });
    }

    const user = await User.findById(userId);
    const blockedUser = await User.findById(blockedUserId);

    if (!user || !blockedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    // Already blocked check
    if (user.blockedUsers.includes(blockedUserId)) {
      return res.status(400).json({ message: "User already blocked." });
    }

    user.blockedUsers.push(blockedUserId);
    await user.save();

    return res.status(200).json({
      message: "User blocked successfully.",
      blockedUsers: user.blockedUsers,
    });
  } catch (error) {
    console.error("Error blocking user:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ✅ Unblock a user
export const unblockUser = async (req, res) => {
  try {
    const { userId, blockedUserId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.blockedUsers = user.blockedUsers.filter(
      (id) => id.toString() !== blockedUserId
    );

    await user.save();

    return res.status(200).json({
      message: "User unblocked successfully.",
      blockedUsers: user.blockedUsers,
    });
  } catch (error) {
    console.error("Error unblocking user:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ✅ Get all blocked users list
export const getBlockedUsers = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate(
      "blockedUsers",
      "fullName email phone profile.avatar"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(200).json({
      blockedUsers: user.blockedUsers || [],
    });
  } catch (error) {
    console.error("Error fetching blocked users:", error);
    return res.status(500).json({ error: error.message });
  }
};


// ✅ Filter contacts that exist in DB
export const filterContacts = async (req, res) => {
  try {
    const { contacts } = req.body; // [{ phone, name }]

    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ message: "Contacts must be an array" });
    }

    const phoneNumbers = contacts.map(c =>
      c.phone?.replace(/\s+/g, "").replace(/^(\+91|91|0)/, "")
    );

    const matchedUsers = await User.find({
      phone: { $in: phoneNumbers }
    }).select("_id fullName phone profile.avatar");

    return res.status(200).json({ matchedUsers });
  } catch (err) {
    console.error("filterContacts error:", err);
    res.status(500).json({ message: "Server error" });
  }
};






