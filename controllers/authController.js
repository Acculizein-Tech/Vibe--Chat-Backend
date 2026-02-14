import jwt from "jsonwebtoken";
import User from "../models/user.js";
import asyncHandler from "../utils/asyncHandler.js";
import sendEmail from "../utils/emailSender.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

// Helper: Generate JWT
const generateToken = (id, expiresIn) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn});
};

// Helper: Generate 6-digit OTP
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();
// ✅ ADD THIS FUNCTION
const generateReferralCode = () => {
  return "SLS" + Math.floor(1000 + Math.random() * 9000);
};


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
  return res.status(400).json({ message: "Cannot register as admin" });
}

  // 🔍 Check if email is already registered
  const existingUser = await User.findOne({ email });
  if (existingUser) {
  if (existingUser.isVerified) {
    return res.status(400).json({ message: "Email is already registered" });
  }

  const now = Date.now();

  if (
    existingUser.emailResendBlock &&
    existingUser.emailResendBlock > now
  ) {
    return res.status(429).json({
      message: "OTP already sent. Please wait before requesting again",
    });
  }

  const otp = generateOTP();
  existingUser.emailVerifyOTP = otp;
  existingUser.emailVerifyExpires = now + 10 * 60 * 1000;
  existingUser.emailResendBlock = now + 30 * 1000;

  await existingUser.save();

  await sendEmail({
    to: existingUser.email,
    subject: "Email Verification OTP",
    text: `Your OTP is: ${otp}`,
  });

  return res.status(200).json({
    success: true,
    message: "OTP resent to your email. Please verify",
  });
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


  // 📧 Send OTP email
  await sendEmail({
    to: user.email,
    subject: "Email Verification OTP",
    // text: `Your OTP is: ${otp}`,
    html:`<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; background:#f5f6fa; padding:20px;">
    <div style="max-width:600px; margin:auto; background:#ffffff; padding:25px; border-radius:10px;">
      
      <h2 style="color:#4A6CF7; margin-bottom:10px;">
        Welcome to <span style="font-weight:bold;">Ryngales</span> 💬✨
      </h2>

      <p style="font-size:15px; line-height:1.6; color:#444;">
        Ryngales ek fast, secure aur simple chatting application hai —  
        jahan aap apne friends, family aur contacts ke saath
        <strong>real-time messages</strong> easily share kar sakte hain.
      </p>

      <h3 style="color:#4A6CF7; margin-top:20px;">🚀 What You Can Do on Ryngales</h3>

      <ul style="color:#444; line-height:1.7; font-size:15px;">
        <li>Instant 1-to-1 secure chatting</li>
        <li>Fast message delivery</li>
        <li>Clean & user-friendly interface</li>
        <li>Privacy-focused communication</li>
        <li>Stay connected anytime, anywhere</li>
      </ul>

      <blockquote style="border-left:4px solid #4A6CF7; padding-left:10px; margin:20px 0; color:#333;">
        <em>"Conversations that feel real, simple, and secure." ✨</em>
      </blockquote>

      <hr style="margin:25px 0; border:none; border-top:1px solid #ddd;">

      <p style="font-size:15px; color:#444;">
        🔐 <strong>Password Reset Verification Code</strong>
        <br>
        <span style="display:inline-block; font-size:22px; margin-top:8px; font-weight:bold; color:#4A6CF7;">
          ${otp}
        </span>
        <br>
        <span style="font-size:13px; color:#888;">
          This code is valid for the next 5 minutes.
        </span>
      </p>

      <hr style="margin:25px 0; border:none; border-top:1px solid #ddd;">

      <p style="font-size:15px; color:#444;">
        Stay connected. Stay secure.<br>
        <strong>Only on <span style="color:#4A6CF7;">Ryngales</span></strong> 💙
      </p>

    </div>
  </body>
</html>`
  });

  // 🔐 Generate tokens
  const accessToken = generateToken(user._id, "15m");
  const refreshToken = generateToken(user._id, "7d");

  user.refreshTokens.push(refreshToken);
  await user.save();

  // ✅ Send response
  res.status(201).json({
    success: true,
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

  res.json({ success: true,  message: "Email verified successfully" });
});

// @desc    Login user
// @route   POST /api/auth/login
// export const login = asyncHandler(async (req, res) => {
//   const { email, password } = req.body;

//   // 🔍 Find user
//   const user = await User.findOne({ email, isDeleted: { $ne: true } });

 
//   // ❌ No user found
//   if (!user) {
//     res.status(401);
//     throw new Error("Invalid email or password");
//   }
//    if (user.isDeleted === true) {
//     res.status(403).json({ message: "Account has been permanently deleted" });
//     return;
//   }
  

//   // 🚫 Deleted account

//   // 🔐 Check password
//   const isMatch = await user.matchPassword(password);
//   if (!isMatch) {
//     res.status(401);
//     throw new Error("Invalid email or password");
//   }

//   // 🚫 Check verification
//   if (!user.isVerified) {
//     res.status(403);
//     throw new Error("Please verify your email first");
//   }

//   // 🎟 Generate tokens
//   const accessToken = generateToken(user._id, "30d");
//   const refreshToken = generateToken(user._id, "7d");

//   // ➕ Save refresh token
//   user.refreshTokens.push(refreshToken);
//   await user.save();

//   // 🟢 Clean response
//   res.json({
//     user: {
//       _id: user._id,
//       fullName: user.fullName,
//       email: user.email,
//       role: user.role,
//       avatar:
//         user.avatar ||
//         "https://bizvility.s3.us-east-1.amazonaws.com/others/1754035118344-others.webp",
//     },
//     accessToken,
//     refreshToken,
//   });
// });
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // 🔍 1. Try active user
  const user = await User.findOne({
    email,
    isDeleted: { $ne: true },
  });

  if (user) {
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
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

    return res.json({
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        avatar:
          user.avatar ||
          "https://bizvility.s3.us-east-1.amazonaws.com/others/1754035118344-others.webp",
      },
      accessToken,
      refreshToken,
    });
  }

  // 🔍 2. Check if deleted account with same original email exists
  const deletedUser = await User.findOne({
    originalEmail: email,
    isDeleted: true,
  });

  if (deletedUser) {
    return res
      .status(403)
      .json({ message: "Account has been permanently deleted" });
  }

  // ❌ 3. Truly invalid
  res.status(401);
  throw new Error("Invalid email or password");
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
    html: `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; background:#f5f6fa; padding:20px;">
    <div style="max-width:600px; margin:auto; background:#ffffff; padding:25px; border-radius:10px;">
      
      <h2 style="color:#4A6CF7; margin-bottom:10px;">
        Reset Your Password 🔐
      </h2>

      <p style="font-size:15px; line-height:1.6; color:#444;">
        We received a request to reset your <strong>Ryngales</strong> account password.
        Use the verification code below to continue.
      </p>

      <hr style="margin:25px 0; border:none; border-top:1px solid #ddd;">

      <p style="font-size:15px; color:#444; text-align:center;">
        <strong>Your verification code</strong>
        <br>
        <span style="
          display:inline-block;
          font-size:26px;
          margin-top:10px;
          font-weight:bold;
          color:#4A6CF7;
          letter-spacing:3px;
        ">
          ${otp}
        </span>
        <br>
        <span style="font-size:13px; color:#888;">
          This code is valid for the next 5 minutes.
        </span>
      </p>

      <hr style="margin:25px 0; border:none; border-top:1px solid #ddd;">

      <p style="font-size:14px; color:#666;">
        If you didn’t request a password reset, please ignore this email.
        Your account is safe.
      </p>

      <p style="font-size:15px; color:#444; margin-top:20px;">
        Stay secure & connected,<br>
        <strong>Team <span style="color:#4A6CF7;">Ryngales</span></strong> 💙
      </p>

    </div>
  </body>
</html>
`
  });

  // 🔐 Generate secure short-lived token
  const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
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
