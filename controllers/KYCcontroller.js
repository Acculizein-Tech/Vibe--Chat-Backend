// controllers/kycController.js
import asyncHandler from '../utils/asyncHandler.js';
import KYC from "../models/KYC.js";
import Business from "../models/Business.js"; 

// ✅ Submit KYC
export const submitKyc = asyncHandler(async (req, res) => {
  const {userId,  panCard, bankDetails } = req.body;
  
// console.log(req.body)
  //  KYC exist 
  const existing = await KYC.findOne({ userId });
  if (existing) {
    return res.status(400).json({ success: false, message: "KYC already submitted" });
  }

  // Aadhaar Business model se laao
  const business = await Business.findOne({ owner: userId });
  // console.log(business);
  if (!business || !business.aadhaarImages?.front || !business.aadhaarImages?.back) {
    return res.status(400).json({ success: false, message: "Aadhaar details not found in Business profile" });
  }

  const kyc = await KYC.create({
    userId,
    aadhaarFront: business.aadhaarImages.aadhaarFront,
    aadhaarBack: business.aadhaarImages.aadhaarBack,
    panCard,
    bankDetails,
  });

  res.status(201).json({
    success: true,
    message: "KYC submitted successfully, waiting for admin verification",
    kyc,
  });
});

// ✅ Get My KYC (User side)
export const getMyKyc = asyncHandler(async (req, res) => {
  const kyc = await KYC.findOne({ userId: req.user._id });
  if (!kyc) {
    return res.status(404).json({ success: false, message: "No KYC found" });
  }
  res.json({ success: true, kyc });
});

// ✅ Admin verify KYC
export const verifyKyc = asyncHandler(async (req, res) => {
  const { isPaymentified } = req.body; // true or false
  const kyc = await KYC.findById(req.params.id);

  if (!kyc) {
    return res.status(404).json({ success: false, message: "KYC not found" });
  }

  kyc.isPaymentified = isPaymentified;
  await kyc.save();

  res.json({ success: true, message: `KYC ${isPaymentified ? "approved" : "rejected"}`, kyc });
});

// ✅ Admin get all KYC requests
export const getAllKyc = asyncHandler(async (req, res) => {
  const kycs = await KYC.find().populate("userId", "fullName email");
  res.json({ success: true, kycs });
});
