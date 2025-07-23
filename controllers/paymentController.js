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
      business
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
