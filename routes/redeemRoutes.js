// routes/redeemRoutes.js
import express from "express";
import { createRedeem, updateRedeemStatus, getMyRedeems, getAllRedeems } from "../controllers/redeemController.js";
import { protect} from "../middlewares/auth.js";
import role from '../middlewares/roles.js';

const router = express.Router();

// User creates redeem
router.post("/create", protect, createRedeem);

// User sees their redeems
router.get("/my", protect, getMyRedeems);

// Admin sees all redeems
router.get("/", protect, role("superadmin"), getAllRedeems);

// Admin updates status
router.put("/:id/status", protect, role("superadmin"), updateRedeemStatus);

export default router;
