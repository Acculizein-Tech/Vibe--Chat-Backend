// controllers/kycController.js
import asyncHandler from '../utils/asyncHandler.js';
import KYC from "../models/KYC.js";
import Business from "../models/Business.js"; 
import axios from 'axios';

// ✅ Submit KYC


// export const submitKyc = asyncHandler(async (req, res) => {
//   const { userId, panCard, bankDetails } = req.body;

//   // Check existing KYC
//   const existing = await KYC.findOne({ userId });
//   if (existing) {
//     return res.status(400).json({ success: false, message: "KYC already submitted" });
//   }

//   // Aadhaar Business model se latest record fetch
//   const business = await Business.findOne({ owner: userId }).sort({ createdAt: -1 });

//   if (!business || !business.aadhaarImages?.front || !business.aadhaarImages?.back) {
//     return res.status(400).json({ success: false, message: "Aadhaar details not found in Business profile" });
//   }

//   // Create new KYC entry
//   const kyc = await KYC.create({
//     userId,
//     aadhaarFront: business.aadhaarImages.front,
//     aadhaarBack: business.aadhaarImages.back,
//     panCard,
//     bankDetails,
//   });

//   res.status(201).json({
//     success: true,
//     message: "KYC submitted successfully, waiting for admin verification",
//     kyc,
//   });
// });


// export const submitKyc = asyncHandler(async (req, res) => {
//   const { userId, panCard, bankDetails } = req.body;

//   // Check existing KYC
//   const existing = await KYC.findOne({ userId });
//   if (existing) {
//     return res.status(400).json({ success: false, message: "KYC already submitted" });
//   }

//   // Aadhaar Business model se latest record fetch
//   const business = await Business.findOne({ owner: userId }).sort({ createdAt: -1 });

//   if (!business || !business.aadhaarImages?.front || !business.aadhaarImages?.back) {
//     return res.status(400).json({ success: false, message: "Aadhaar details not found in Business profile" });
//   }

//   // 🔹 Create RazorpayX Contact
//   let contactId;
//   try {
//     const contactRes = await axios.post(
//       "https://api.razorpay.com/v1/contacts",
//       {
//         name: bankDetails.accountHolderName,   // bank account holder ka naam
//         email: req.user?.email || "noemail@test.com", // optional but better if present
//         contact: req.user?.phone || "9999999999",     // optional
//         type: "customer",  // ya "employee"/"vendor" bhi ho sakta h
//         reference_id: userId.toString(),
//       },
//       {
//         auth: {
//           username: process.env.RAZORPAY_KEY_ID,
//           password: process.env.RAZORPAY_KEY_SECRET,
//         },
//       }
//     );

//     contactId = contactRes.data.id; // e.g. cont_Jx6Xb...
//     console.log("✅ Razorpay Contact Created:", contactId);
//   } catch (err) {
//     console.error("❌ Failed to create Razorpay Contact:", err.response?.data || err.message);
//     return res.status(500).json({ success: false, message: "Failed to create Razorpay Contact" });
//   }

//   // Create new KYC entry with contactId
//   const kyc = await KYC.create({
//     userId,
//     aadhaarFront: business.aadhaarImages.front,
//     aadhaarBack: business.aadhaarImages.back,
//     panCard,
//     bankDetails,
//     razorpayContactId: contactId,   // 🔹 Save contact id here
//   });

//   res.status(201).json({
//     success: true,
//     message: "KYC submitted successfully, waiting for admin verification",
//     kyc,
//   });
// });


export const submitKyc = asyncHandler(async (req, res) => {
  const { userId, panCard, bankDetails } = req.body;

  // Check existing KYC
  const existing = await KYC.findOne({ userId });
  if (existing) {
    return res.status(400).json({ success: false, message: "KYC already submitted" });
  }

  // Aadhaar Business model se latest record fetch
  const business = await Business.findOne({ owner: userId }).sort({ createdAt: -1 });

  if (!business || !business.aadhaarImages?.front || !business.aadhaarImages?.back) {
    return res.status(400).json({ success: false, message: "Aadhaar details not found in Business profile" });
  }

  // 1️⃣ Create RazorpayX Contact
  let contactId;
  try {
    const contactRes = await axios.post(
      "https://api.razorpay.com/v1/contacts",
      {
        name: bankDetails.accountHolderName,
        email: req.user?.email || "noemail@test.com",
        contact: req.user?.phone || "9999999999",
        type: "customer",
        reference_id: userId.toString(),
      },
      {
        auth: {
          username: process.env.RAZORPAY_KEY_ID,
          password: process.env.RAZORPAY_KEY_SECRET,
        },
      }
    );

    contactId = contactRes.data.id; // e.g. cont_Jx6Xb...
    console.log("✅ Razorpay Contact Created:", contactId);
  } catch (err) {
    console.error("❌ Failed to create Razorpay Contact:", err.response?.data || err.message);
    return res.status(500).json({ success: false, message: "Failed to create Razorpay Contact" });
  }

  // 2️⃣ Create RazorpayX Fund Account
  let fundAccountId;
  try {
    const fundRes = await axios.post(
      "https://api.razorpay.com/v1/fund_accounts",
      {
        contact_id: contactId,
        account_type: "bank_account",
        bank_account: {
          name: bankDetails.accountHolderName,
          ifsc: bankDetails.ifsc,
          account_number: bankDetails.accountNumber,
        },
      },
      {
        auth: {
          username: process.env.RAZORPAY_KEY_ID,
          password: process.env.RAZORPAY_KEY_SECRET,
        },
      }
    );

    fundAccountId = fundRes.data.id; // e.g. fa_Jy3asd...
    console.log("✅ Razorpay Fund Account Created:", fundAccountId);
  } catch (err) {
    console.error("❌ Failed to create Fund Account:", err.response?.data || err.message);
    return res.status(500).json({ success: false, message: "Failed to create Fund Account" });
  }

  // 3️⃣ Save KYC entry with both IDs
  const kyc = await KYC.create({
    userId,
    aadhaarFront: business.aadhaarImages.front,
    aadhaarBack: business.aadhaarImages.back,
    panCard,
    bankDetails,
    razorpayContactId: contactId,
    razorpayFundAccountId: fundAccountId,  // 🔹 Now saving fund account too
  });

  res.status(201).json({
    success: true,
    message: "KYC submitted successfully, Please wait upto 48 hours for verification",
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
// ✅ Verify KYC (Super Admin Only)
export const verifyKyc = asyncHandler(async (req, res) => {
  try {
    const { isPaymentified } = req.body; // true / false
    const { id } = req.params;

 

    // 🛑 Validate input
    if (typeof isPaymentified !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "Invalid value for isPaymentified. Must be true or false.",
      });
    }

    // 🔍 Find KYC record
    const kyc = await KYC.findById(id);
    if (!kyc) {
      return res.status(404).json({
        success: false,
        message: "KYC record not found",
      });
    }

    // 🚫 Prevent duplicate updates (already approved/rejected)
    if (kyc.isPaymentified === isPaymentified) {
      return res.status(400).json({
        success: false,
        message: `KYC already ${isPaymentified ? "approved" : "rejected"}`,
      });
    }

    // ✅ Update KYC status
    kyc.isPaymentified = isPaymentified;
    kyc.verifiedBy = req.user._id; // keep track of who verified
    kyc.verifiedAt = new Date();

    await kyc.save();

    // 📝 Audit log (optional: save in logs collection)
    // await AuditLog.create({
    //   action: "VERIFY_KYC",
    //   userId: req.user._id,
    //   targetId: id,
    //   status: isPaymentified ? "APPROVED" : "REJECTED",
    // });

    res.status(200).json({
      success: true,
      message: `KYC ${isPaymentified ? "approved ✅" : "rejected ❌"}`,
      kyc,
    });
  } catch (error) {
    console.error("❌ Error verifying KYC:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});


// ✅ Admin get all KYC requests
export const getAllKyc = asyncHandler(async (req, res) => {
  const kycs = await KYC.find().populate("userId", "fullName email");
  res.json({ success: true, kycs });
});
