import express from "express";
import crypto from "crypto";

import {
  createOrder,
  verifyPayment,
  getPayments,
} from "../controllers/paymentController.js";

import { protect } from "../middlewares/auth.js";

const router = express.Router();

// ✅ Secure Routes for Authenticated Users
router.post("/create-order", protect, createOrder);
router.post("/verify", protect, verifyPayment);
router.get("/history", protect, getPayments);

// ✅ Razorpay Webhook (NO auth here, Razorpay server will send requests)
router.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const secret = "mywebhooksecret"; // same as in Razorpay dashboard webhook config

  const signature = req.headers["x-razorpay-signature"];
  const body = req.body;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(body))
    .digest("hex");

  if (expectedSignature === signature) {
    console.log("✅ Webhook verified:", body.event);

    // Optional: Add event-specific logic
    // Example:
    // if (body.event === "payment.captured") {
    //   const paymentData = body.payload.payment.entity;
    //   // Store in DB, update status, etc.
    // }

    return res.status(200).json({ success: true, received: true });
  } else {
    return res.status(400).json({ success: false, message: "Invalid webhook signature" });
  }
});

export default router;
