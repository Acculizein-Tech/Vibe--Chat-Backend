import express from "express";
import { protect } from "../middlewares/auth.js";
import {
  createEmiPlan,
  deleteEmiPlan,
  listEmiPlans,
  recordEmiPayment,
  updateEmiPlan,
} from "../controllers/emiPlanController.js";

const router = express.Router();

router.get("/", protect, listEmiPlans);
router.post("/", protect, createEmiPlan);
router.patch("/:id", protect, updateEmiPlan);
router.post("/:id/payments", protect, recordEmiPayment);
router.delete("/:id", protect, deleteEmiPlan);

export default router;
