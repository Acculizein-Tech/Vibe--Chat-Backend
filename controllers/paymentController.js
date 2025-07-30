// controllers/paymentController.js
import asyncHandler from "../utils/asyncHandler.js";
import crypto from "crypto";
import razorpay from "../utils/razorpayInstance.js";
import Payment from "../models/Payment.js";
import path from "path";
import { generateInvoicePDF } from "../utils/pdfInvoiceGenerator.js"; // ✅ Adjust path
import Business from "../models/Business.js";


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
export const createOrder = asyncHandler(async (req, res) => {
  const { amount } = req.body;

  const options = {
    amount: amount * 100,
    currency: "INR",
    receipt: `rcpt_${Date.now()}`,
  };

  const order = await razorpay.orders.create(options);

  res.status(200).json({
    success: true,
    order,
  });
});

// ✅ Step 2: Verify & Save Payment
// ✅ Step 2: Verify & Save Payment
export const verifyPayment = asyncHandler(async (req, res) => {
  try {
    const {
      razorpay: {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      },
      business,
      companyData 
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        status: "fail",
        message: "Missing payment credentials"
      });
    }

    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid Razorpay signature"
      });
    }

    // ✅ GST Calculation logic
    const amount = business.planPrice || 0;
    const baseAmount = parseFloat((amount / 1.18).toFixed(2));
    const gstAmount = parseFloat((amount - baseAmount).toFixed(2));
    const isUP = (business.state || "").toLowerCase() === "uttar pradesh";

    const payment = await Payment.create({
      user: req.user._id,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      amount,
      baseAmount,
      tax: {
        cgst: isUP ? parseFloat((gstAmount / 2).toFixed(2)) : 0,
        sgst: isUP ? parseFloat((gstAmount / 2).toFixed(2)) : 0,
        igst: isUP ? 0 : gstAmount,
      },
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
        gstin: companyData?.gstin
      }
    });

    return res.status(200).json({
      status: "success",
      message: "Payment verified and stored successfully",
      data: payment
    });

  } catch (err) {
    console.error("Error verifying payment:", err);
    return res.status(500).json({
      status: "fail",
      message: "Internal Server Error",
      error: err.message
    });
  }
});






// ✅ Step 3: Get Payment History
export const getPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find().populate("user").sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: payments.length,
    payments,
  });
});

//get the payment data by user id
export const getPaymentsByUserId = asyncHandler(async (req, res) => { 
  const userId = req.user._id;

  const payments = await Payment.find({ user: userId }).populate("user").sort({ createdAt: -1 });

  if (!payments || payments.length === 0) {
    return res.status(404).json({
      success: false,
      message: "No payments found for this user",
    });
  }

  res.status(200).json({
    success: true,
    count: payments.length,
    payments,
  });
});

// ✅ Step 4: Generate Invoice PDF
// export const generateInvoice = asyncHandler(async (req, res) => { 
//   const { paymentId } = req.params;

//   if (!paymentId) {
//     return res.status(400).json({
//       success: false,
//       message: "Payment ID is required"
//     });
//   }

//   const payment = await Payment.findById(paymentId).populate("user");

//   if (!payment) {
//     return res.status(404).json({
//       success: false,
//       message: "Payment not found"
//     });
//   }

//   // Generate PDF invoice using a library like pdfkit or any other
//   const invoicePDF = await generatePDFInvoice(payment);

//   res.status(200).json({
//     success: true,
//     message: "Invoice generated successfully",
//     data: invoicePDF
//   });
// });

//get the all verify payment details to superadmin
export const getAllVerifiedPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.find({ status: "success" })
    .populate("user")
    .sort({ createdAt: -1 });

  if (!payments || payments.length === 0) {
    return res.status(404).json({
      success: false,
      message: "No verified payments found",
    });
  }

  res.status(200).json({
    success: true,
    count: payments.length,
    payments,
  });
});