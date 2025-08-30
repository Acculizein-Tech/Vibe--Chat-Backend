// controllers/redeemController.js
import asyncHandler from '../utils/asyncHandler.js';
import Redeem from "../models/Redeem.js";
import User from "../models/user.js";
import KYC from "../models/KYC.js";

// ✅ Create Redeem Request
export const createRedeem = asyncHandler(async (req, res) => {
  const { amount, mode, upiId, bankAccount } = req.body;
  const userId = req.user._id;

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ success: false, message: "User not found" });

  // ✅ KYC check
  const kyc = await KYC.findOne({ userId });
  if (!kyc || !kyc.isPaymentified) {
    return res.status(400).json({ success: false, message: "KYC not verified. Complete KYC first." });
  }

  // ✅ Wallet balance check
  if (amount < 500) {
    return res.status(400).json({ success: false, message: "Minimum redeem amount is ₹500" });
  }
  if (user.wallet.balance < amount) {
    return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
  }

  // ✅ Deduct balance immediately (hold)
  user.wallet.balance -= amount;
  user.wallet.history.push({
    amount,
    type: "debit",
    method: "Redeem",
    status: "pending",
    date: new Date(),
  });
  await user.save();

  // ✅ Create redeem request
  const redeem = await Redeem.create({
    userId,
    amount,
    mode,
    upiId: mode === "UPI" ? upiId : null,
    bankAccount: mode === "BANK_TRANSFER" ? bankAccount : null,
    status: "PENDING",
  });

  res.status(201).json({
    success: true,
    message: "Redeem request submitted. Waiting for admin approval.",
    walletBalance: user.wallet.balance,
    redeem,
  });
});

// ✅ Admin approve/reject redeem
export const updateRedeemStatus = asyncHandler(async (req, res) => {
  const { status } = req.body; // PROCESSING / SUCCESS / FAILED
  const redeem = await Redeem.findById(req.params.id).populate("userId");

  if (!redeem) {
    return res.status(404).json({ success: false, message: "Redeem request not found" });
  }

  redeem.status = status;
  await redeem.save();

  // ✅ If failed, refund balance
  if (status === "FAILED") {
    redeem.userId.wallet.balance += redeem.amount;
    redeem.userId.wallet.history.push({
      amount: redeem.amount,
      type: "credit",
      method: "Refund",
      status: "success",
      date: new Date(),
    });
    await redeem.userId.save();
  }

  res.json({
    success: true,
    message: `Redeem marked as ${status}`,
    redeem,
  });
});

// ✅ Get my redeem requests
export const getMyRedeems = asyncHandler(async (req, res) => {
  const redeems = await Redeem.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, redeems });
});

// ✅ Admin get all requests
export const getAllRedeems = asyncHandler(async (req, res) => {
  const redeems = await Redeem.find().populate("userId", "fullName email");
  res.json({ success: true, redeems });
});
