import express from "express";
import crypto from "crypto";

import {
  createOrder,
  verifyPayment,
  getPayments,   
  getPaymentsByUserId,
  getAllVerifiedPayments,
  getAllPayments,
  getPaymentByPaymentId
} from "../controllers/paymentController.js";

import { protect } from "../middlewares/auth.js";
import roles from "../middlewares/roles.js";

const router = express.Router();

// ✅ Secure Routes for Authenticated Users
router.post("/create-order", protect, createOrder);
router.post("/verify", protect, verifyPayment);
router.get("/history", protect, getPayments);
router.get('/getuserpayments', protect, getPaymentsByUserId);
router.get('/all-verified', protect, roles('superadmin'), getAllVerifiedPayments); 

router.get('/all', protect, roles('superadmin'), getAllPayments);

router.get("/:paymentId", protect, roles('customer', 'superadmin'), getPaymentByPaymentId);

export default router;
