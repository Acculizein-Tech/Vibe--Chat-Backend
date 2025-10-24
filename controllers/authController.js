import jwt from "jsonwebtoken";
import User from "../models/user.js";
import asyncHandler from "../utils/asyncHandler.js";
import sendEmail from "../utils/emailSender.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
// import Lead from "../models/Leads.js"; // Import Lead  model
// import { notifyUser, notifyRole } from "../utils/sendNotification.js"; // Import notification functions

// Helper: Generate JWT
const generateToken = (id, expiresIn) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn });
};

// Helper: Generate 6-digit OTP
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();
// ✅ ADD THIS FUNCTION
const generateReferralCode = () => {
  return "SLS" + Math.floor(1000 + Math.random() * 9000);
};

// export const register = asyncHandler(async (req, res) => {
//   const {
//     fullName,
//     email,
//     phone,
//     password,
//     role = "customer",
//     profile = {},
//     referralCode,
//   } = req.body;

//   // 🚫 Restrict admin/superadmin registration
//   if (["admin", "superadmin"].includes(role)) {
//     res.status(400);
//     throw new Error("Cannot register as admin");
//   }

//   // 🔍 Check if email is already registered
//   const existingUser = await User.findOne({ email });
//   if (existingUser) {
//     if (existingUser.isVerified) {
//       res.status(400);
//       throw new Error("Email is already registered");
//     } else {
//       res.status(400);
//       throw new Error(
//         "You already registered. Please verify your email or request a new OTP"
//       );
//     }
//   }

//   // 🔐 Generate OTP
//   // const otp = Math.floor(100000 + Math.random() * 900000).toString();
//   // const otpExpires = Date.now() + 10 * 60 * 1000;
//   const otp = generateOTP();
//   const now = Date.now();
//   const otpExpires = now + 10 * 60 * 1000; // 10 minutes
//   const resendCooldown = now + 30 * 1000; // 30 seconds

//   let referredBy = null;
//   let salesExecutive = null;

//   // 🔁 Assign sales executive via referral
//   if (referralCode && role === "customer") {
//     const refUser = await User.findOne({ referralCode });
//     if (refUser) {
//       referredBy = refUser._id;
//       salesExecutive = refUser._id;
//     } else {
//       return res.status(400).json({ message: "Invalid referral code" });
//     }
//   }

//   // 🔁 Auto-generate referralCode for sales user
//   let generatedReferralCode;
//   if (role === "sales") {
//     let unique = false;
//     while (!unique) {
//       const temp = generateReferralCode();
//       const exists = await User.findOne({ referralCode: temp });
//       if (!exists) {
//         generatedReferralCode = temp;
//         unique = true;
//       }
//     }
//   }

//   // 👤 Create user
//   const user = await User.create({
//     fullName,
//     email,
//     phone,
//     password,
//     role,
//     profile,
//     emailVerifyOTP: otp,
//     emailVerifyExpires: otpExpires,
//     emailResendBlock: resendCooldown,
//     referralCode: generatedReferralCode,
//     referredBy,
//   });

//   // 🔁 Round-robin fallback sales assignment (if no referral)
//   // ✅ Assign sales executive ONLY if referral code is used
//   // if (referralCode && !salesExecutive) {
//   //   const salesUsers = await User.find({ role: 'sales' });
//   //   if (salesUsers.length > 0) {
//   //     const index = Math.floor(Math.random() * salesUsers.length);
//   //     salesExecutive = salesUsers[index]._id;
//   //   }
//   // }

//   // 📌 Create a lead with follow-up reminder (for cron job)
//   await Lead.create({
//     name: user.fullName,
//     contact: user.email,
//     businessType: "Unknown",
//     status: "Interested",
//     notes: "Signed up on website",
//     salesUser: salesExecutive || null,
//     followUpDate: new Date(Date.now() + 2 * 60 * 1000), // ⏰ 2 minutes from now
//   });

//   // 🔔 Notifications
//   const notificationData = {
//     userId: user._id,
//     userName: user.fullName,
//     userEmail: user.email,
//     redirectPath: `/admin/users/${user._id}`, // your frontend admin user path
//   };

//   // ➤ Notify associated sales user if exists
//   if (salesExecutive) {
//     await notifyUser({
//       userId: salesExecutive,
//       type: "LEAD_GENERATED",
//       title: "🎯 New Lead Assigned",
//       message: `A new user "${user.fullName}" has signed up and is assigned to you.`,
//       data: notificationData,
//     });
//   }

//   // ➤ Notify Admins and SuperAdmins
//   await Promise.all([
//     notifyRole({
//       role: "admin",
//       type: "LEAD_GENERATED",
//       title: "🆕 New User Registered",
//       message: `"${user.fullName}" registered as a customer.`,
//       data: notificationData,
//     }),
//     notifyRole({
//       role: "superadmin",
//       type: "LEAD_GENERATED",
//       title: "🆕 New User Registered",
//       message: `"${user.fullName}" registered as a customer.`,
//       data: notificationData,
//     }),
//   ]);

//   // 📧 Send OTP email
//   await sendEmail({
//     to: user.email,
//     subject: "Email Verification OTP",
//     text: `Your OTP is: ${otp}`,
//   });

//   // 🔐 Generate tokens
//   const accessToken = generateToken(user._id, "15m");
//   const refreshToken = generateToken(user._id, "7d");

//   user.refreshTokens.push(refreshToken);
//   await user.save();

//   // ✅ Send response
//   res.status(201).json({
//     accessToken,
//     refreshToken,
//     message: "OTP sent to your email for verification",
//   });
// });

export const register = asyncHandler(async (req, res) => {
  const {
    fullName,
    email,
    phone,
    password,
    role = "customer",
    profile = {},
    referralCode,
  } = req.body;

  // 🚫 Restrict admin/superadmin registration
  if (["admin", "superadmin"].includes(role)) {
    res.status(400);
    throw new Error("Cannot register as admin");
  }

  // 🔍 Check if email is already registered
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    if (existingUser.isVerified) {
      res.status(400);
      throw new Error("Email is already registered");
    } else {
      res.status(400);
      throw new Error(
        "You already registered. Please verify your email or request a new OTP"
      );
    }
  }

  // 🔐 Generate OTP
  const otp = generateOTP();
  const now = Date.now();
  const otpExpires = now + 10 * 60 * 1000; // 10 minutes
  const resendCooldown = now + 30 * 1000; // 30 seconds

  let referredBy = null;

  // 🔁 Handle referral (ANY user can refer)
  if (referralCode) {
    const refUser = await User.findOne({ referralCode });
    if (refUser) {
      referredBy = refUser._id;

      // 💰 Credit wallet for the referrer
      const rewardAmount = 100; // <-- you can configure this value
      refUser.wallet.balance += rewardAmount;
      refUser.wallet.history.push({
        amount: rewardAmount,
        type: "credit",
        description: `Referral reward for inviting ${fullName}`,
      });
      await refUser.save();
    } else {
      return res.status(400).json({ message: "Invalid referral code" });
    }
  }

  // 🔁 Auto-generate referralCode for every new user
  let generatedReferralCode;
  let unique = false;
  while (!unique) {
    const temp = generateReferralCode();
    const exists = await User.findOne({ referralCode: temp });
    if (!exists) {
      generatedReferralCode = temp;
      unique = true;
    }
  }

  // 👤 Create user
  const user = await User.create({
    fullName,
    email,
    phone,
    password,
    role,
    profile,
    emailVerifyOTP: otp,
    emailVerifyExpires: otpExpires,
    emailResendBlock: resendCooldown,
    referralCode: generatedReferralCode,
    referredBy,
  });

  // 📌 Create a lead with follow-up reminder
  // await Lead.create({
  //   name: user.fullName,
  //   contact: user.email,
  //   businessType: "Unknown",
  //   status: "Interested",
  //   notes: "Signed up on website",
  //   salesUser: null,
  //   followUpDate: new Date(Date.now() + 2 * 60 * 1000), // ⏰ 2 minutes from now
  // });

  // // 🔔 Notifications
  // const notificationData = {
  //   userId: user._id,
  //   userName: user.fullName,
  //   userEmail: user.email,
  //   redirectPath: `/admin/users/${user._id}`,
  // };

  // await Promise.all([
  //   notifyRole({
  //     role: "admin",
  //     type: "LEAD_GENERATED",
  //     title: "🆕 New User Registered",
  //     message: `"${user.fullName}" registered as a customer.`,
  //     data: notificationData,
  //   }),
  //   notifyRole({
  //     role: "superadmin",
  //     type: "LEAD_GENERATED",
  //     title: "🆕 New User Registered",
  //     message: `"${user.fullName}" registered as a customer.`,
  //     data: notificationData,
  //   }),
  // ]);

  // 📧 Send OTP email
  await sendEmail({
    to: user.email,
    subject: "Email Verification OTP",
    text: `Your OTP is: ${otp}`,
  });

  // 🔐 Generate tokens
  const accessToken = generateToken(user._id, "15m");
  const refreshToken = generateToken(user._id, "7d");

  user.refreshTokens.push(refreshToken);
  await user.save();

  // ✅ Send response
  res.status(201).json({
    accessToken,
    refreshToken,
    message: "OTP sent to your email for verification",
  });
});





export const verifyEmailOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const user = await User.findOne({ email });

  if (!user) throw new Error("User not found");
  if (
    user.emailVerifyOTP !== otp ||
    !user.emailVerifyExpires ||
    user.emailVerifyExpires < Date.now()
  ) {
    res.status(400);
    throw new Error("Invalid or expired OTP");
  }

  user.isVerified = true;
  user.emailVerifyOTP = undefined;
  user.emailVerifyExpires = undefined;
  await user.save();

  res.json({ message: "Email verified successfully" });
});

// @desc    Login user
// @route   POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  // console.log(user);

  if (!user || !(await user.email)) {
    res.status(401);
    throw new Error("Create your account first");
  }

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  if (!user.isVerified) {
    res.status(403);
    throw new Error("Please verify your email first");
  }

  const accessToken = generateToken(user._id, "30d");
  const refreshToken = generateToken(user._id, "7d");

  user.refreshTokens.push(refreshToken);
  await user.save();

  res.json({
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    avatar:
      user.profile?.avatar ||
      "https://bizvility.s3.us-east-1.amazonaws.com/others/1754035118344-others.webp", // ✅ safely include avatar
    accessToken,
    refreshToken,
  });
});


// @route   POST /api/auth/refresh
export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(401);
    throw new Error("No refresh token provided");
  }

  const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id);

  if (!user || !user.refreshTokens.includes(refreshToken)) {
    res.status(403);
    throw new Error("Invalid refresh token");
  }

  const newAccessToken = generateToken(user._id, "15m");
  res.json({ accessToken: newAccessToken });
});



// @desc    Forgot password - send OTP
// @route   POST /api/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  const otp = generateOTP();
  const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  user.resetPasswordOTP = otp;
  user.resetPasswordExpires = otpExpires;
  await user.save();

  await sendEmail({
    to: user.email,
    subject: "Forgot Password OTP",
    text: `Your OTP to reset password is: ${otp}`,
  });

  // 🔐 Generate secure short-lived token
  const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "10m",
  });

  res.json({
    message: "OTP sent to your email for password reset",
    resetToken, // 🚀 Send this to frontend
  });
});


// /api/auth/verify-forgot-otp
export const verifyForgotOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400);
    throw new Error("Email and OTP are required");
  }

  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  if (
    user.resetPasswordOTP !== otp ||
    !user.resetPasswordExpires ||
    user.resetPasswordExpires < Date.now()
  ) {
    res.status(400);
    throw new Error("Invalid or expired OTP");
  }

  // ✅ Mark OTP as verified (optional flag)
  user.isResetOTPVerified = true;
  await user.save();

  res.json({ message: "OTP verified. You may now reset your password." });
});

export const logout = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization; // Already lowercased
  console.log("Logout - Auth Header:", authHeader); // Add this log

  if (!authHeader?.startsWith('Bearer ')) { // Strict with space
    res.status(401);
    throw new Error("No token found");
  }

  const token = authHeader.split(' ')[1].trim();
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id);

  if (!user) {
    res.status(401);
    throw new Error("User not found");
  }

  user.refreshTokens = [];
  await user.save();

  res.json({ message: "Logged out successfully" });
});
//resend OTP for email verification
// export const resendOTP = asyncHandler(async (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//     res.status(400);
//     throw new Error("Email is required");
//   }

//   const user = await User.findOne({ email });

//   if (!user) {
//     res.status(404);
//     throw new Error("User not found");
//   }

//   const now = Date.now();

//   // 🕒 If resend attempted before 30 seconds passed
//   if (user.emailVerifyExpires && user.emailVerifyExpires > now) {
//     return res.status(429).json({
//       success: false,
//       message: "OTP already sent. Please wait 30 seconds for new OTP.",
//     });
//   }

//   // ✅ Generate new OTP & set 30s resend cooldown
//   const otp = generateOTP(); // e.g., '872349'
//   const otpExpires = now + 30 * 1000; // 30 seconds cooldown

//   user.emailVerifyOTP = otp;
//   user.emailVerifyExpires = otpExpires;
//   await user.save();

//   // 📧 Send email
//   await sendEmail({
//     to: user.email,
//     subject: "Your Verification OTP",
//     text: `Your OTP is: ${otp}\n\nPlease use this OTP within 10 minutes.`,
//   });

//   res.status(200).json({
//     success: true,
//     message: "A new OTP has been sent to your email.",
//   });
// });


// export const resendOTP = asyncHandler(async (req, res) => {
//   const { email } = req.body;

//   if (!email) {
//     res.status(400);
//     throw new Error('Email is required');
//   }

//   const user = await User.findOne({ email });

//   if (!user) {
//     res.status(404);
//     throw new Error('User not found');
//   }

//   const now = Date.now();

//   // 🛑 Block resend if within 30 seconds cooldown
//   if (user.emailResendBlock && user.emailResendBlock > now) {
//     return res.status(429).json({
//       success: false,
//       message: 'OTP already sent. Please wait 30 seconds before requesting again.',
//     });
//   }

//   // ✅ Generate new OTP
//   const otp = Math.floor(100000 + Math.random() * 900000).toString();

//   // Update OTP + expiry + cooldown
//   user.emailVerifyOTP = otp;
//   user.emailVerifyExpires = now + 10 * 60 * 1000;   // OTP valid for 10 min
//   user.emailResendBlock = now + 30 * 1000;          // Resend blocked for 30 sec
//   await user.save();

//   // 📧 Send OTP to email
//   await sendEmail({
//     to: user.email,
//     subject: 'Your New OTP',
//     text: `Your new OTP is: ${otp}\n\nIt is valid for 10 minutes.`,
//   });

//   res.status(200).json({
//     success: true,
//     message: 'A new OTP has been sent to your email.',
//   });
// });

// resendOTP.js
export const resendOTP = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    res.status(400);
    throw new Error('Email is required');
  }

  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const now = Date.now();

  // 🛑 Cooldown check
  if (user.emailResendBlock && user.emailResendBlock > now) {
    return res.status(429).json({
      success: false,
      message: 'OTP already sent. Please wait 30 seconds before requesting again.',
    });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // ✨ Update all relevant OTP fields
  user.emailVerifyOTP = otp;
  user.emailVerifyExpires = now + 10 * 60 * 1000;

  user.resetPasswordOTP = otp;
  user.resetPasswordExpires = now + 10 * 60 * 1000;

  user.emailResendBlock = now + 30 * 1000;

  await user.save();

  // 📧 Send email
  await sendEmail({
    to: user.email,
    subject: 'Your New OTP',
    text: `Your new OTP is: ${otp}\n\nIt is valid for 10 minutes.`,
  });

  res.status(200).json({
    success: true,
    message: 'A new OTP has been sent to your email.',
  });
});



//reset password
export const resetPassword = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  if (password.length < 8) {
    res.status(400);
    throw new Error("Password must be at least 8 characters long");
  }

  const user = await User.findOne({ email });

  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }

  user.password = password; // plain text (gets hashed by pre-save)
  user.markModified("password"); // 🔥 Force Mongoose to re-hash password

  user.resetPasswordOTP = undefined;
  user.resetPasswordExpires = undefined;
  user.isResetOTPVerified = undefined;

  await user.save();

  res.json({ message: "Password has been updated successfully" });
});