// controllers/paymentController.js
import asyncHandler from "../utils/asyncHandler.js";
import crypto from "crypto";
import razorpay from "../utils/razorpayInstance.js";
import Payment from "../models/Payment.js";
import path from "path";
import { generateInvoicePDF } from "../utils/pdfInvoiceGenerator.js"; // ✅ Adjust path
import Business from "../models/Business.js";
import InvoiceCounter from "../models/InvoiceCounter.js"; // ✅ NEW IMPORT

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


export const verifyPayment = asyncHandler(async (req, res) => {
  try {
    const {
      razorpay: { razorpay_order_id, razorpay_payment_id, razorpay_signature },
      business,
      companyData,
    } = req.body;

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

    // Step 2: Calculate GST correctly (Base + GST = Total)
    const baseAmount = parseFloat((business.planPrice || 0).toFixed(2)); // ₹ without GST
    const gstAmount = parseFloat((baseAmount * 0.18).toFixed(2));        // 18% GST
    const totalAmount = parseFloat((baseAmount + gstAmount).toFixed(2)); // Final Total ₹

    // ✅ Step 2.1: Check if buyer is from UP
    const buyerState = (business?.state || "").trim().toLowerCase();
    const isUP = buyerState === "uttar pradesh";

    // Step 3: Generate invoice number in format BZ/01/25-26 (Atomic)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const fyStart = currentMonth >= 3 ? currentYear : currentYear - 1;
    const fyEnd = fyStart + 1;
    const financialYear = `${fyStart.toString().slice(-2)}-${fyEnd
      .toString()
      .slice(-2)}`;

    const counter = await InvoiceCounter.findOneAndUpdate(
      { financialYear },
      { $inc: { sequence: 1 } },
      { new: true, upsert: true }
    );

    const sequenceNumber = counter.sequence.toString().padStart(2, "0");
    const invoiceNumber = `BZ/${sequenceNumber}/${financialYear}`;

    // Step 4: Save payment to DB
    const payment = await Payment.create({
      user: req.user._id,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      amount: totalAmount, // ✅ store final paid amount
      baseAmount,          // ₹ without GST
      totalAmount,         // ✅ Final Total stored in DB
      tax: {
        cgst: isUP ? parseFloat((gstAmount / 2).toFixed(2)) : 0,
        sgst: isUP ? parseFloat((gstAmount / 2).toFixed(2)) : 0,
        igst: !isUP ? gstAmount : 0,
      },
      invoiceNumber,
      isUP, // ✅ directly store true/false based on state
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
    });

    // Step 5: Send response
    return res.status(200).json({
      status: "success",
      message: "Payment verified and stored successfully",
      invoiceNumber,
      data: payment,
    });
  } catch (err) {
    console.error("Error verifying payment:", err);
    return res.status(500).json({
      status: "fail",
      message: "Internal Server Error",
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
      gstin: p.billingDetails?.gstin || "NA",
      price: p.baseAmount?.toFixed(2) || "0.00",
      cgst: p.tax?.cgst?.toFixed(2) || "0.00",
      sgst: p.tax?.sgst?.toFixed(2) || "0.00",
      igst: p.tax?.igst?.toFixed(2) || "0.00",
      total: p.totalAmount?.toFixed(2) || "0.00",
    },
  }));

  res.status(200).json({
    success: true,
    count: formattedPayments.length,
    payments: formattedPayments,
  });
});




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

//live rozorpay webhook details of payment

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


// GET Payment by Payment ID
// export const getPaymentByPaymentId = asyncHandler(async (req, res) => {
//   try {
//     const { paymentId } = req.params;

//     if (!paymentId) {
//       return res.status(400).json({ message: "Payment ID is required" });
//     }

//     // check payment in DB
//     const payment = await Payment.findOne({ paymentId });

//     if (!payment) {
//       return res.status(404).json({ message: "Payment not found" });
//     }

//     return res.status(200).json({
//       success: true,
//       data: payment,
//       companyDetails: {
//         companyName: process.env.COMPANY_NAME || "",
//         gstin: process.env.COMPANY_GSTIN || "",
//         email: process.env.COMPANY_EMAIL || "info@acculizeintech.com",
//         phone: process.env.COMPANY_PHONE || "",
//         invoiceDate: payment.createdAt
//           ? payment.createdAt.toISOString().split("T")[0] // yyyy-mm-dd
//           : "",
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching payment:", error.message);
//     return res.status(500).json({ message: "Server error", error: error.message });
//   }
// });

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
