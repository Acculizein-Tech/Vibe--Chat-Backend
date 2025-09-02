// controllers/paymentController.js
import asyncHandler from "../utils/asyncHandler.js";
import crypto from "crypto";
import razorpay from "../utils/razorpayInstance.js";
import Payment from "../models/Payment.js";
import path from "path";
import { generateInvoicePDF } from "../utils/pdfInvoiceGenerator.js"; // ✅ Adjust path
import Business from "../models/Business.js";
import InvoiceCounter from "../models/InvoiceCounter.js"; // ✅ NEW IMPORT
import User from "../models/user.js";
import Razorpay from "razorpay";
import Kyc from '../models/KYC.js';
import axios from "axios";



// ✅ GST Calculation
const calculateGST = (amount, state) => {
  const baseAmount = parseFloat((amount / 1.18).toFixed(2));
  const gstAmount = parseFloat((amount - baseAmount).toFixed(2));

  if (state.toLowerCase() === "uttar pradesh") {
    return {
      baseAmount,
      cgst: parseFloat((gstAmount / 2).toFixed(2)),
      sgst: parseFloat((gstAmount / 2).toFixed(2)),
      igst: 0,
      isUP: true,
    };
  } else {
    return {
      baseAmount,
      cgst: 0,
      sgst: 0,
      igst: gstAmount,
      isUP: false,
    };
  }
};

// ✅ Step 1: Create Razorpay Order
// export const createOrder = asyncHandler(async (req, res) => {
//   const { amount } = req.body;

//   const options = {
//     amount: amount * 100,
//     currency: "INR",
//     receipt: `rcpt_${Date.now()}`,
//   };

//   const order = await razorpay.orders.create(options);

//   res.status(200).json({
//     success: true,
//     order,
//   });
// });

export const createOrder = asyncHandler(async (req, res) => {
  const { amount, user_id, referral_code } = req.body;

  if (!amount || !user_id) {
    return res.status(400).json({
      success: false,
      message: "Amount and UserId are required",
    });
  }

  const options = {
    amount: amount * 100, // Razorpay amount in paise
    currency: "INR",
    receipt: `rcpt_${Date.now()}`,
    notes: {
      userId: user_id, // jiska payment ho raha hai
      referralCode: referral_code || null, // agar referralCode diya hai to save ho jayega
    },
  };

  try {
    const order = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("❌ Razorpay Order Create Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create Razorpay order",
      error: error.message,
    });
  }
});


// ✅ Step 2: Verify & Save Payment


// export const verifyPayment = asyncHandler(async (req, res) => {
//   try {
//     const {
//       razorpay: { razorpay_order_id, razorpay_payment_id, razorpay_signature },
//       business,
//       companyData,
//     } = req.body;

//     // Step 1: Validate Razorpay credentials
//     if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
//       return res.status(400).json({
//         status: "fail",
//         message: "Missing payment credentials",
//       });
//     }

//     const generated_signature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//       .digest("hex");

//     if (generated_signature !== razorpay_signature) {
//       return res.status(400).json({
//         status: "fail",
//         message: "Invalid Razorpay signature",
//       });
//     }

//     // Step 2: Calculate GST correctly (Base + GST = Total)
//     const baseAmount = parseFloat((business.planPrice || 0).toFixed(2)); // ₹ without GST
//     const gstAmount = parseFloat((baseAmount * 0.18).toFixed(2));        // 18% GST
//     const totalAmount = parseFloat((baseAmount + gstAmount).toFixed(2)); // Final Total ₹

    // // ✅ Step 2.1: Check if buyer is from UP
    // const buyerState = (business?.state || "").trim().toLowerCase();
    // const isUP = buyerState === "uttar pradesh";

//     // Step 3: Generate invoice number in format BZ/01/25-26 (Atomic)
//     const now = new Date();
//     const currentYear = now.getFullYear();
//     const currentMonth = now.getMonth();
//     const fyStart = currentMonth >= 3 ? currentYear : currentYear - 1;
//     const fyEnd = fyStart + 1;
//     const financialYear = `${fyStart.toString().slice(-2)}-${fyEnd
//       .toString()
//       .slice(-2)}`;

//     const counter = await InvoiceCounter.findOneAndUpdate(
//       { financialYear },
//       { $inc: { sequence: 1 } },
//       { new: true, upsert: true }
//     );

//     const sequenceNumber = counter.sequence.toString().padStart(2, "0");
//     const invoiceNumber = `BZ/${sequenceNumber}/${financialYear}`;

//     // Step 4: Save payment to DB
//     const payment = await Payment.create({
//       user: req.user._id,
//       orderId: razorpay_order_id,
//       paymentId: razorpay_payment_id,
//       signature: razorpay_signature,
//       HSN: process.env.BUSINESS_HSN, // Default HSN if not provided
//       amount: totalAmount, // ✅ store final paid amount
//       baseAmount,          // ₹ without GST
//       totalAmount,         // ✅ Final Total stored in DB
//       tax: {
//         cgst: isUP ? parseFloat((gstAmount / 2).toFixed(2)) : 0,
//         sgst: isUP ? parseFloat((gstAmount / 2).toFixed(2)) : 0,
//         igst: !isUP ? gstAmount : 0,
//       },
//       invoiceNumber,
//       isUP, // ✅ directly store true/false based on state
//       status: "success",
//       billingDetails: {
//         ...business,
//         currency: "INR",
//       },
//       companyData: {
//         companyName: companyData?.companyName,
//         companyAddress: companyData?.companyAddress,
//         companyPhone: companyData?.companyPhone,
//         companyEmail: companyData?.companyEmail,
//         state: companyData?.state,
//         gstin: companyData?.gstin,
//       },
//     });

//     // Step 5: Send response
//     return res.status(200).json({
//       status: "success",
//       message: "Payment verified and stored successfully",
//       invoiceNumber,
//       data: payment,
//     });
//   } catch (err) {
//     console.error("Error verifying payment:", err);
//     return res.status(500).json({
//       status: "fail",
//       message: "Internal Server Error",
//       error: err.message,
//     });
//   }
// });


// export const verifyPayment = asyncHandler(async (req, res) => {
//   try {
//     const {
//       razorpay: { razorpay_order_id, razorpay_payment_id, razorpay_signature },
//       business,
//       companyData,
//       referralCode, // ✅ incoming referralCode from frontend (if used)
//     } = req.body;

//     // Step 1: Validate Razorpay credentials
//     if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
//       return res.status(400).json({
//         status: "fail",
//         message: "Missing payment credentials",
//       });
//     }

//     const generated_signature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//       .digest("hex");

//     if (generated_signature !== razorpay_signature) {
//       return res.status(400).json({
//         status: "fail",
//         message: "Invalid Razorpay signature",
//       });
//     }

//     // -----------------------
//     // Step 2: Inclusive GST logic
//     // -----------------------
//     let totalAmount = parseFloat((business.planPrice || 0).toFixed(2)); // Inclusive price (e.g., 3500)

//     let referralData = {}; // to store referral info in Payment model

//     // Step 3: Referral code check
//     if (referralCode) {
//       const referrer = await User.findOne({ referralCode });

//       if (referrer) {
//         // Deduct ₹300 from customer’s payable amount
//         totalAmount = totalAmount - 300;

//         // ✅ Credit ₹300 to referrer’s wallet
//         referrer.wallet.balance += 300;
//         referrer.wallet.history.push({
//           amount: 300,
//           type: "credit",
//           description: `Referral bonus from ${req.user.fullName || "a new user"}`,
//         });
//         await referrer.save();

//         // ✅ Prepare referral data for Payment model
//         referralData = {
//           code: referralCode,
//           referrer: referrer._id,
//           bonusAmount: 300,
//         };
//       }
//     }

//     // Step 4: Compute base & GST (reverse calculation from inclusive price)
//     const baseAmount = parseFloat((totalAmount / 1.18).toFixed(2));
//     const gstAmount = parseFloat((totalAmount - baseAmount).toFixed(2));

    // // Step 5: Check buyer state
    // const buyerState = (business?.state || "").trim().toLowerCase();
    // const isUP = buyerState === "uttar pradesh";

    

//     // Step 6: Generate invoice number
//     const now = new Date();
//     const currentYear = now.getFullYear();
//     const currentMonth = now.getMonth();
//     const fyStart = currentMonth >= 3 ? currentYear : currentYear - 1;
//     const fyEnd = fyStart + 1;
//     const financialYear = `${fyStart.toString().slice(-2)}-${fyEnd
//       .toString()
//       .slice(-2)}`;

//     const counter = await InvoiceCounter.findOneAndUpdate(
//       { financialYear },
//       { $inc: { sequence: 1 } },
//       { new: true, upsert: true }
//     );

//     const sequenceNumber = counter.sequence.toString().padStart(2, "0");
//     const invoiceNumber = `BZ/${sequenceNumber}/${financialYear}`;

    // // Step 7: Save Payment with referral details
    // const payment = await Payment.create({
    //   user: req.user._id,
    //   orderId: razorpay_order_id,
    //   paymentId: razorpay_payment_id,
    //   signature: razorpay_signature,
    //   HSN: process.env.BUSINESS_HSN,
    //   amount: totalAmount,   // ✅ Inclusive amount paid
    //   baseAmount,            // ✅ Extracted base (without GST)
    //   totalAmount,           // ✅ Final inclusive amount stored
    //   tax: {
    //     cgst: isUP ? parseFloat((gstAmount / 2).toFixed(2)) : 0,
    //     sgst: isUP ? parseFloat((gstAmount / 2).toFixed(2)) : 0,
    //     igst: !isUP ? gstAmount : 0,
    //   },
    //   invoiceNumber,
    //   isUP,
    //   status: "success",
    //   billingDetails: {
    //     ...business,
    //     currency: "INR",
    //   },
    //   companyData: {
    //     companyName: companyData?.companyName,
    //     companyAddress: companyData?.companyAddress,
    //     companyPhone: companyData?.companyPhone,
    //     companyEmail: companyData?.companyEmail,
    //     state: companyData?.state,
    //     gstin: companyData?.gstin,
    //   },
    //   referral: referralData, // ✅ new field inside Payment
    // });

//     return res.status(200).json({
//       status: "success",
//       message: "Payment verified and stored successfully",
//       invoiceNumber,
//       data: payment,
//     });
//   } catch (err) {
//     console.error("Error verifying payment:", err);
//     return res.status(500).json({
//       status: "fail",
//       message: "Internal Server Error",
//       error: err.message,
//     });
//   }
// });


// export const verifyPayment = asyncHandler(async (req, res) => {
//   try {
    // const {
    //   razorpay: { razorpay_order_id, razorpay_payment_id, razorpay_signature },
    //   business,
    //   companyData,
    //   referralCode, // keep same
    // } = req.body;

//     if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
//       return res.status(400).json({ status: "fail", message: "Missing payment credentials" });
//     }

//     const generated_signature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//       .digest("hex");

//     if (generated_signature !== razorpay_signature) {
//       return res.status(400).json({ status: "fail", message: "Invalid Razorpay signature" });
//     }

//     // ---------- Inclusive amount (planPrice) ----------
//     let totalAmount = parseFloat((business.planPrice || 0).toFixed(2)); // inclusive (e.g., 3500.00)

//     // Referral handling (₹300 off to buyer, ₹300 credit to referrer)
//     let referralData = undefined;
//     if (referralCode) {
//       const referrer = await User.findOne({ referralCode });
//       if (referrer) {
//         totalAmount = parseFloat(Math.max(0, totalAmount - 300).toFixed(2)); // keep names, clamp >= 0

//         // wallet credit (no name changes)
//         referrer.wallet.balance += 300;
//         referrer.wallet.history.push({
//           amount: 300,
//           type: "credit",
//           description: `Referral bonus from ${req.user.fullName || "a new user"}`,
//           date: new Date(),
//         });
//         await referrer.save();

//         referralData = { code: referralCode, referrer: referrer._id, bonusAmount: 300 };
//       }
//     }

//     // ---------- Exact paise rounding so base + tax = total ----------
//     const toPaise = (n) => Math.round(Number(n) * 100);
//     const fromPaise = (p) => Number((p / 100).toFixed(2));

//     const totalPaise = toPaise(totalAmount);              // e.g., 350000
//     const basePaise  = Math.round((totalPaise * 100) / 118); // reverse-calc base in paise
//     const gstPaise   = totalPaise - basePaise;            // exact GST paise

//     // State split
//     const buyerState = (business?.state || "").trim().toLowerCase();
//     const isUP = buyerState === "uttar pradesh";

//     let cgstPaise = 0, sgstPaise = 0, igstPaise = 0;
//     if (isUP) {
//       // Split with remainder so cgst+sgst == gst exactly
//       cgstPaise = Math.floor(gstPaise / 2);
//       sgstPaise = gstPaise - cgstPaise; // remainder goes to SGST
//     } else {
//       igstPaise = gstPaise;
//     }

//     // Final display numbers (names unchanged)
//     const baseAmount = fromPaise(basePaise);
//     const gstAmount  = fromPaise(gstPaise); // not stored separately but used for clarity
//     const tax = {
//       cgst: fromPaise(cgstPaise),
//       sgst: fromPaise(sgstPaise),
//       igst: fromPaise(igstPaise),
//     };

//     // ---------- Invoice number ----------
//     const now = new Date();
//     const currentYear = now.getFullYear();
//     const currentMonth = now.getMonth();
//     const fyStart = currentMonth >= 3 ? currentYear : currentYear - 1;
//     const fyEnd = fyStart + 1;
//     const financialYear = `${fyStart.toString().slice(-2)}-${fyEnd.toString().slice(-2)}`;

//     const counter = await InvoiceCounter.findOneAndUpdate(
//       { financialYear },
//       { $inc: { sequence: 1 } },
//       { new: true, upsert: true }
//     );

//     const sequenceNumber = counter.sequence.toString().padStart(2, "0");
//     const invoiceNumber = `BZ/${sequenceNumber}/${financialYear}`;

//     // ---------- Save (field names unchanged) ----------
//     const payment = await Payment.create({
//       user: req.user._id,
//       orderId: razorpay_order_id,
//       paymentId: razorpay_payment_id,
//       signature: razorpay_signature,
//       HSN: process.env.BUSINESS_HSN,
//       amount: totalAmount,         // inclusive
//       baseAmount,                  // extracted base
//       totalAmount,                 // inclusive (kept)
//       tax,                         // exact split so base+tax = total
//       invoiceNumber,
//       isUP,
//       status: "success",
//       billingDetails: {
//         ...business,
//         currency: "INR",
//       },
//       companyData: {
//         companyName: companyData?.companyName,
//         companyAddress: companyData?.companyAddress,
//         companyPhone: companyData?.companyPhone,
//         companyEmail: companyData?.companyEmail,
//         state: companyData?.state,
//         gstin: companyData?.gstin,
//       },
//       // store referral details if present (schema already supports it)
//       ...(referralData ? { referral: referralData } : {}),
//     });

//     return res.status(200).json({
//       status: "success",
//       message: "Payment verified and stored successfully",
//       invoiceNumber,
//       data: payment,
//     });
//   } catch (err) {
//     console.error("Error verifying payment:", err);
//     return res.status(500).json({ status: "fail", message: "Internal Server Error", error: err.message });
//   }
// });

// export const verifyPayment = asyncHandler(async (req, res) => {
//   try {
//     const {
//       razorpay: { razorpay_order_id, razorpay_payment_id, razorpay_signature },
//       business,
//       companyData,
//       referralCode,
//     } = req.body;

//     // Step 1: Validate Razorpay credentials
//     if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
//       return res.status(400).json({
//         status: "fail",
//         message: "Missing payment credentials",
//       });
//     }

//     const generated_signature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//       .digest("hex");

//     if (generated_signature !== razorpay_signature) {
//       return res.status(400).json({
//         status: "fail",
//         message: "Invalid Razorpay signature",
//       });
//     }

//     // -----------------------
//     // Step 2: Inclusive GST logic
//     // -----------------------
//     let totalAmount = parseFloat((business.planPrice || 0).toFixed(2));

//     let referralData = {};

//     // Step 3: Referral code check
//     if (referralCode) {
//       const referrer = await User.findOne({ referralCode });

//       if (referrer) {
//         totalAmount = totalAmount - 300;

//         referrer.wallet.balance += 300;
//         referrer.wallet.history.push({
//           amount: 300,
//           type: "credit",
//           description: `Referral bonus from ${req.user.fullName || "a new user"}`,
//         });
//         await referrer.save();

//         referralData = {
//           code: referralCode,
//           referrer: referrer._id,
//           bonusAmount: 300,
//         };
//       }
//     }

//     // Step 4: Compute base & GST
//     const baseAmount = parseFloat((totalAmount / 1.18).toFixed(2));
//     const gstAmount = parseFloat((totalAmount - baseAmount).toFixed(2));

//     // Step 5: Check buyer state
//     const buyerState = (business?.state || "").trim().toLowerCase();
//     const isUP = buyerState === "uttar pradesh";

//     // Step 6: Tax breakdown with adjustment
//     let cgst = 0, sgst = 0, igst = 0;
//     if (isUP) {
//       const halfGST = gstAmount / 2;
//       cgst = parseFloat(halfGST.toFixed(2));  // round CGST
//       sgst = parseFloat((gstAmount - cgst).toFixed(2)); // adjust SGST
//     } else {
//       igst = gstAmount;
//     }

//     // Step 7: Generate invoice number
//     const now = new Date();
//     const currentYear = now.getFullYear();
//     const currentMonth = now.getMonth();
//     const fyStart = currentMonth >= 3 ? currentYear : currentYear - 1;
//     const fyEnd = fyStart + 1;
//     const financialYear = `${fyStart.toString().slice(-2)}-${fyEnd
//       .toString()
//       .slice(-2)}`;

//     const counter = await InvoiceCounter.findOneAndUpdate(
//       { financialYear },
//       { $inc: { sequence: 1 } },
//       { new: true, upsert: true }
//     );

//     const sequenceNumber = counter.sequence.toString().padStart(2, "0");
//     const invoiceNumber = `BZ/${sequenceNumber}/${financialYear}`;

//     // Step 8: Save Payment with referral details
//     const payment = await Payment.create({
//       user: req.user._id,
//       orderId: razorpay_order_id,
//       paymentId: razorpay_payment_id,
//       signature: razorpay_signature,
//       HSN: process.env.BUSINESS_HSN,
//       amount: totalAmount,
//       baseAmount,
//       totalAmount,
//       tax: {
//         cgst,
//         sgst,
//         igst,
//       },
//       invoiceNumber,
//       isUP,
//       status: "success",
//       billingDetails: {
//         ...business,
//         currency: "INR",
//       },
//       companyData: {
//         companyName: companyData?.companyName,
//         companyAddress: companyData?.companyAddress,
//         companyPhone: companyData?.companyPhone,
//         companyEmail: companyData?.companyEmail,
//         state: companyData?.state,
//         gstin: companyData?.gstin,
//       },
//       referral: referralData,
//     });

//     return res.status(200).json({
//       status: "success",
//       message: "Payment verified and stored successfully",
//       invoiceNumber,
//       data: payment,
//     });
//   } catch (err) {
//     console.error("Error verifying payment:", err);
//     return res.status(500).json({
//       status: "fail",
//       message: "Internal Server Error",
//       error: err.message,
//     });
//   }
// });


// export const verifyPayment = asyncHandler(async (req, res) => {
//   try {
//     const {
//       razorpay: { razorpay_order_id, razorpay_payment_id, razorpay_signature },
//       business,
//       companyData,
//       referral_code, // ✅ aayega taaki wallet credit kare
//     } = req.body;

    // // Step 1: Validate Razorpay credentials
    // if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    //   return res.status(400).json({
    //     status: "fail",
    //     message: "Missing payment credentials",
    //   });
    // }

    // const generated_signature = crypto
    //   .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    //   .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    //   .digest("hex");

    // if (generated_signature !== razorpay_signature) {
    //   return res.status(400).json({
    //     status: "fail",
    //     message: "Invalid Razorpay signature",
    //   });
    // }

//     // -----------------------
//     // Step 2: Total from frontend (already discounted if referral used)
//     // -----------------------
//     let totalAmount = parseFloat((business.planPrice || 0).toFixed(2));

//     let referralData = {};

//     // Step 3: Referral wallet credit (no discount calculation here)
//     if (referral_code) {
//       const referrer = await User.findOne({   referralCode: referral_code });

//       if (referrer) {
//         // ✅ Wallet me paisa daalna
//         referrer.wallet.balance += 300;
//         referrer.wallet.history.push({
//           amount: 300,
//           type: "credit",
//           description: `Referral bonus from ${req.user.fullName || "a new user"}`,
//           fromUser: req.user._id,
//           fromEmail: req.user.email,
//         });
//         await referrer.save();

//         referralData = {
//           code: referral_code,
//           referrer: referrer._id,
//           bonusAmount: 300,
//         };
//       }
//     }

//     // Step 4: Compute base & GST
//     const baseAmount = parseFloat((totalAmount / 1.18).toFixed(2));
//     const gstAmount = parseFloat((totalAmount - baseAmount).toFixed(2));

//     // Step 5: Buyer state
//     const buyerState = (business?.state || "").trim().toLowerCase();
//     const isUP = buyerState === "uttar pradesh";

//     // Step 6: Tax breakdown
//     let cgst = 0, sgst = 0, igst = 0;
//     if (isUP) {
//       const halfGST = gstAmount / 2;
//       cgst = parseFloat(halfGST.toFixed(2));
//       sgst = parseFloat((gstAmount - cgst).toFixed(2));
//     } else {
//       igst = gstAmount;
//     }

//     // Step 7: Invoice number
//     const now = new Date();
//     const currentYear = now.getFullYear();
//     const currentMonth = now.getMonth();
//     const fyStart = currentMonth >= 3 ? currentYear : currentYear - 1;
//     const fyEnd = fyStart + 1;
//     const financialYear = `${fyStart.toString().slice(-2)}-${fyEnd
//       .toString()
//       .slice(-2)}`;

//     const counter = await InvoiceCounter.findOneAndUpdate(
//       { financialYear },
//       { $inc: { sequence: 1 } },
//       { new: true, upsert: true }
//     );

//     const sequenceNumber = counter.sequence.toString().padStart(2, "0");
//     const invoiceNumber = `BZ/${sequenceNumber}/${financialYear}`;

//     // Step 8: Save Payment
//     const payment = await Payment.create({
//       user: req.user._id,
//       orderId: razorpay_order_id,
//       paymentId: razorpay_payment_id,
//       signature: razorpay_signature,
//       HSN: process.env.BUSINESS_HSN,
//       amount: totalAmount, // ✅ already discounted if referral used
//       baseAmount,
//       totalAmount,
//       tax: {
//         cgst,
//         sgst,
//         igst,
//       },
//       invoiceNumber,
//       isUP,
//       status: "success",
//       billingDetails: {
//         ...business,
//         currency: "INR",
//       },
//       companyData: {
//         companyName: companyData?.companyName,
//         companyAddress: companyData?.companyAddress,
//         companyPhone: companyData?.companyPhone,
//         companyEmail: companyData?.companyEmail,
//         state: companyData?.state,
//         gstin: companyData?.gstin,
//       },
//       referral: referralData, // ✅ stored only for record
//     });

//     return res.status(200).json({
//       status: "success",
//       message: "Payment verified and stored successfully",
//       invoiceNumber,
//       data: payment,
//     });
//   } catch (err) {
//     console.error("Error verifying payment:", err);
//     return res.status(500).json({
//       status: "fail",
//       message: "Internal Server Error",
//       error: err.message,
//     });
//   }
// });

// export const verifyPayment = asyncHandler(async (req, res) => {
//   try {
//     const {
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature,
//     } = req.body;

//     // Step 1: Verify Signature
//     const sign = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(razorpay_order_id + "|" + razorpay_payment_id)
//       .digest("hex");

//     if (sign !== razorpay_signature) {
//       return res.status(400).json({ success: false, message: "Invalid signature" });
//     }

//     // Step 2: Fetch Order
//     const order = await razorpay.orders.fetch(razorpay_order_id);
//     const totalAmount = order.amount / 100; // INR
//     const userId = order.notes?.userId;
//     const referralCode = order.notes?.referralCode;

//     // Step 3: Tax Calculation
//     const baseAmount = parseFloat((totalAmount / 1.18).toFixed(2));
//     const gstAmount = parseFloat((totalAmount - baseAmount).toFixed(2));

//     let cgst = 0, sgst = 0, igst = 0;
//     const isUP = (order.notes?.state || "").toLowerCase() === "uttar pradesh";

//     if (isUP) {
//       cgst = parseFloat((gstAmount / 2).toFixed(2));
//       sgst = gstAmount - cgst;
//     } else {
//       igst = gstAmount;
//     }

//     // Step 4: Referral Handling
//     let referralData = {};
//     if (referralCode) {
//       const referrer = await User.findOne({ referralCode });
//       if (referrer) {
//         referrer.wallet.balance += 300;
//         referrer.wallet.history.push({
//           amount: 300,
//           type: "credit",
//           description: `Referral bonus from user ${userId}`,
//         });
//         await referrer.save();

//         referralData = {
//           code: referralCode,
//           referrer: referrer._id,
//           bonusAmount: 300,
//         };
//       }
//     }

//     // Step 5: Invoice Number
//     const now = new Date();
//     const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
//     const fyEnd = fyStart + 1;
//     const financialYear = `${fyStart.toString().slice(-2)}-${fyEnd.toString().slice(-2)}`;

//     const counter = await InvoiceCounter.findOneAndUpdate(
//       { financialYear },
//       { $inc: { sequence: 1 } },
//       { new: true, upsert: true }
//     );

//     const invoiceNumber = `BZ/${counter.sequence.toString().padStart(3, "0")}/${financialYear}`;

//     // Step 6: Save Payment
//     const payment = await Payment.create({
//       user: userId,
//       orderId: razorpay_order_id,
//       paymentId: razorpay_payment_id,
//       signature: razorpay_signature,
//       amount: totalAmount,
//       baseAmount,
//       tax: { cgst, sgst, igst },
//       invoiceNumber,
//       referral: referralData,
//       status: "success",
//     });

//     res.status(200).json({
//       success: true,
//       message: "Payment verified successfully",
//       invoiceNumber,
//       payment,
//     });
//   } catch (err) {
//     console.error("Payment verification error:", err);
//     res.status(500).json({ success: false, message: "Payment verification failed", error: err.message });
//   }
// });
export const verifyPayment = asyncHandler(async (req, res) => {
  try {
    const {
      razorpay: { razorpay_order_id, razorpay_payment_id, razorpay_signature },
      business,
      companyData,
    } = req.body;

    // ✅ Step 1: Verify Razorpay signature
  // Step 1: Validate Razorpay credentials
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        status: "fail",
        message: "Missing payment credentials",
      });
    }

    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid Razorpay signature",
      });
    }

    // ✅ Step 2: Fetch Razorpay order
    const order = await razorpay.orders.fetch(razorpay_order_id);
    const totalAmount = order.amount / 100; // INR
    const userId = order.notes?.userId;
    const referralCode = order.notes?.referralCode;
    console.log("Fetched order:", referralCode, userId, totalAmount);
    
console.log("🔹 userId:", userId);
console.log("🔹 referralCode:", referralCode);
console.log("🔹 notes object:", order.notes);

    // ✅ Step 3: Tax calculation
    const baseAmount = parseFloat((totalAmount / 1.18).toFixed(2));
    const gstAmount = parseFloat((totalAmount - baseAmount).toFixed(2));

    // ✅ Step 2.1: Check if buyer is from UP
    const buyerState = (business?.state || "").trim().toLowerCase();
    const isUP = buyerState === "uttar pradesh";

    // let cgst = 0, sgst = 0, igst = 0;
    // const isUP = (order.notes?.state || "").toLowerCase() === "uttar pradesh";

    // if (isUP) {
    //   cgst = parseFloat((gstAmount / 2).toFixed(2));
    //   sgst = parseFloat((gstAmount - cgst).toFixed(2));
    // } else {
    //   igst = gstAmount;
    // }
    

    // ✅ Step 4: Referral handling
  // Step 4: Referral handling
    let referralData = {};
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        referrer.wallet.balance += 300;
        referrer.wallet.history.push({
          amount: 300,
          type: "credit",
          description: `Referral bonus from user ${userId}`,
          fromUser: userId,
        });
        await referrer.save();

        referralData = {
          code: referralCode,
          referrer: referrer._id,
          bonusAmount: 300,
        };
      }
    }

    // Step 5: Invoice n

    // ✅ Step 5: Invoice number generation
    const now = new Date();
    const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyEnd = fyStart + 1;
    const financialYear = `${fyStart.toString().slice(-2)}-${fyEnd.toString().slice(-2)}`;

    const counter = await InvoiceCounter.findOneAndUpdate(
      { financialYear },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true }
    );

    const invoiceNumber = `BZ/${counter.sequence.toString().padStart(3, "0")}/${financialYear}`;

    // ✅ Step 6: Save payment
    // Step 7: Save Payment with referral details
    const payment = await Payment.create({
      user: req.user._id,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      HSN: process.env.BUSINESS_HSN,
      amount: totalAmount,   // ✅ Inclusive amount paid
      baseAmount,            // ✅ Extracted base (without GST)
      totalAmount,           // ✅ Final inclusive amount stored
      tax: {
        cgst: isUP ? parseFloat((gstAmount / 2).toFixed(2)) : 0,
        sgst: isUP ? parseFloat((gstAmount / 2).toFixed(2)) : 0,
        igst: !isUP ? gstAmount : 0,
      },
      invoiceNumber,
      isUP,
      status: "success",
      billingDetails: {
        ...business,
        currency: "INR",
      },
      companyData: {
        companyName: companyData?.companyName,
        companyAddress: companyData?.companyAddress,
        companyPhone: companyData?.companyPhone,
        companyEmail: companyData?.companyEmail,
        state: companyData?.state,
        gstin: companyData?.gstin,
      },
      referral: referralData, // ✅ new field inside Payment
    });
    res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      invoiceNumber,
      payment,
    });
  } catch (err) {
    console.error("Payment verification error:", err);
    res.status(500).json({
      success: false,
      message: "Payment verification failed",
      error: err.message,
    });
  }
});



// ✅ Step 3: Get Payment History


export const getPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find()
    .populate("user")
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: payments.length,
    payments,
  });
});

//get the payment data by user id

export const getPaymentsByUserId = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const payments = await Payment.find({ user: userId })
    .populate("user")
    .sort({ createdAt: -1 }); 

  if (!payments || payments.length === 0) {
    return res.status(404).json({
      success: false,
      message: "No payments found for this user",
    });
  }

  // 🔥 Transform payments to required format
  const formattedPayments = payments.map((p) => ({
    companyDetails: {
      companyName: process.env.COMPANY_NAME || "Acculizein Tech Pvt Ltd",
      gstin: process.env.COMPANY_GSTIN || "09AAXCB1234E1Z7",
      email: process.env.COMPANY_EMAIL || "info@acculizeintech.com",
      phone: process.env.COMPANY_PHONE || "+91 8650006677",
      invoiceDate: p.createdAt.toISOString().split("T")[0], // yyyy-mm-dd
    },
    userPaymentDetails: {
      planTitle: p.billingDetails?.planName || "NA",
      invoiceNumber: p.invoiceNumber || "NA",
      businessOwner: p.billingDetails?.ownerName || "NA",
      paidDate: p.createdAt.toISOString().split("T")[0],
      billTo: p.billingDetails?.businessName || "NA",
      email: p.billingDetails?.email || "NA",
      status: p.status || "NA", 
      address: p.billingDetails?.state || "NA",
      location: p.billingDetails?.location || "NA",
      userGst: p.billingDetails?.userGst || "NA",
      gstin: p.billingDetails?.gstin || "NA",
      price: p.baseAmount?.toFixed(2) || "0.00",
      cgst: p.tax?.cgst?.toFixed(2) || "0.00",
      sgst: p.tax?.sgst?.toFixed(2) || "0.00",
      igst: p.tax?.igst?.toFixed(2) || "0.00",
      total: p.totalAmount?.toFixed(2) || "0.00",
      isUP: p.isUP || false
    },
  }));

  res.status(200).json({
    success: true,
    count: formattedPayments.length,
    payments: formattedPayments,
  });
});


//live rozorpay webhook details of payment

export const getAllVerifiedPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ status: "success" })
    .populate({
      path: "user",
      select:
        "profile.avatar fullName email createdAt updatedAt city country state zipCode phone",
    })
    .sort({ createdAt: -1 })
    .lean();

  if (!payments || payments.length === 0) {
    return res.status(404).json({
      success: false,
      message: "No verified payments found",
    });
  }

  // ✅ Format result
  const result = payments.map((p) => ({
    _id: p._id,
    tax: p.tax,
    billingDetails: {
      ...p.billingDetails,
      orderId: p.orderId,
      paymentId: p.paymentId,
      signature: p.signature,
      invoiceNumber: p.invoiceNumber,
      amount: p.amount,
      baseAmount: p.baseAmount,
      isUP: p.isUP,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    },
    user: p.user,
  }));

  res.status(200).json({
    success: true,
    count: result.length,
    payments: result,
  });
});



export const getAllPayments = async (req, res) => {
  try {
    const payments = await razorpay.payments.all({
      count: 50, // max 100
    });

    res.status(200).json({
      success: true,
      data: payments.items,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
      error: error.message,
    });
  }
};

export const getPaymentByPaymentId = asyncHandler(async (req, res) => {
  try {
    const { paymentId } = req.params;

    // 1️⃣ Validate Payment ID
    if (!paymentId || typeof paymentId !== "string") {
      return res.status(400).json({ 
        success: false,
        message: "Valid Payment ID is required" 
      });
    }

    // 2️⃣ Fetch Payment
    const payment = await Payment.findOne({ paymentId }).lean();

    if (!payment) {
      return res.status(404).json({ 
        success: false,
        message: "Payment not found" 
      });
    }

    // 3️⃣ Prepare Response
    return res.status(200).json({
      success: true,
      data: payment,
      companyDetails: {
        companyName: process.env.COMPANY_NAME || "Acculize Intech Pvt Ltd",
        gstin: process.env.COMPANY_GSTIN || "22AAAAA0000A1Z5",
        email: process.env.COMPANY_EMAIL || "info@acculizeintech.com",
        phone: process.env.COMPANY_PHONE || "+91-9999999999",
        invoiceDate: payment?.createdAt
          ? new Date(payment.createdAt).toISOString().split("T")[0] // yyyy-mm-dd
          : "",
      },
    });
  } catch (error) {
    console.error("❌ Error fetching payment by ID:", error);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error", 
      error: error.message 
    });
  }
});


const razorpayX = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ✅ Redeem Wallet Balance




// export const redeemBalance = asyncHandler(async (req, res) => {
//   const { userId, amount } = req.body;
//   // const userId = req.user._id; // ✅ agar auth middleware use karna ho

//   if (!amount || isNaN(amount) || amount <= 0) {
//     return res.status(400).json({ message: "Invalid redeem amount" });
//   }

//   if (amount < 200) {
//     return res.status(400).json({ message: "Minimum redeem amount is ₹200" });
//   }

//   const user = await User.findById(userId);
//   if (!user) {
//     return res.status(404).json({ message: "User not found" });
//   }

//   // ✅ Get KYC details
//   const kyc = await Kyc.findOne({ userId });
//   if (!kyc || !kyc.isPaymentified) {
//     return res.status(400).json({ message: "KYC not verified for payouts" });
//   }

//   if (user.wallet.balance < amount) {
//     return res.status(400).json({ message: "Insufficient wallet balance" });
//   }

//   try {
//     // ✅ FundAccountId directly from KYC
//     const fundAccountId = kyc.razorpayFundAccountId;
//     if (!fundAccountId) {
//       return res.status(400).json({ message: "Fund account not found. Please complete KYC again." });
//     }

//     // ✅ Create RazorpayX Payout
//     const payout = await axios.post(
//       "https://api.razorpayx.com/v1/payouts",
//       {
//         account_number: process.env.RAZORPAYX_ACCOUNT_NO, // RazorpayX virtual account number
//         fund_account_id: fundAccountId,
//         amount: amount * 100, // paise
//         currency: "INR",
//         mode: "NEFT", // or "IMPS"/"UPI"
//         purpose: "payout",
//         queue_if_low_balance: true,
//         narration: `Redeem for user ${userId}`,
//       },
//       {
//         auth: {
//           username: process.env.RAZORPAY_KEY_ID,
//           password: process.env.RAZORPAY_KEY_SECRET,
//         },
//       }
//     );

//     // ✅ Update Wallet
//     user.wallet.balance -= amount;
//     user.wallet.history.push({
//       amount,
//       type: "debit",
//       method: "RazorpayX",
//       status: payout.data.status || "pending",
//       date: new Date(),
//       transactionId: payout.data.id,
//     });

//     // ✅ Save Payout History in user model
//     user.payoutHistory.push({
//       payoutId: payout.data.id,
//       fundAccountId,
//       amount,
//       status: payout.data.status || "pending",
//       mode: payout.data.mode || "NEFT",
//       createdAt: new Date(),
//     });

//     await user.save();

//     return res.json({
//       success: true,
//       message: "Redeem request successful",
//       payout: payout.data,
//       walletBalance: user.wallet.balance,
//     });
//   } catch (error) {
//     console.error("❌ RazorpayX Payout Error:", error.response?.data || error.message);

//     return res.status(500).json({
//       success: false,
//       message: "Server is busy due to high traffic of users. Please try again ",
//       error: error.response?.data || error.message,
//     });
//   }
// });

export const redeemBalance = asyncHandler(async (req, res) => {
  const { userId, amount } = req.body;
  // const userId = req.user._id; // ✅ agar auth middleware use karna ho
try {
  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ message: "Invalid redeem amount" });
  }

  if (amount < 10000) {
    return res.status(400).json({ message: "Minimum redeem amount is ₹10000" });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // ✅ Get KYC details
  const kyc = await Kyc.findOne({ userId });
  if (!kyc || !kyc.isPaymentified) {
    return res.status(400).json({ message: "KYC not verified for payouts" });
  }

  if (user.wallet.balance < amount) {
    return res.status(400).json({ message: "Insufficient wallet balance" });
  }
  res.status(200).json({ message: `Redeem request is being processed. Please wait upto 7 business working days for your amount ₹${amount} INR` });
} catch (error) {
  console.error("❌ Error occurred while redeeming balance:", error);
  return res.status(500).json({ message: "Internal server error" });
}

});
