// routes/kycRoutes.js
import express from "express";
import { submitKyc, getMyKyc, verifyKyc, getAllKyc } from "../controllers/KYCcontroller.js";
import { protect } from "../middlewares/auth.js";
import role from "../middlewares/roles.js";

const router = express.Router();

// User submit KYC
router.post("/submit", protect, submitKyc);

// User fetch their KYC status
router.get("/my", protect, getMyKyc);

// Admin fetch all KYC requests
router.get("/", protect, role("superadmin", "admin"), getAllKyc);

// Admin verify KYC
router.put("/:id/verify", protect, role("superadmin", "admin"), verifyKyc);

export default router;
