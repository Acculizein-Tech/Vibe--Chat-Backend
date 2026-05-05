import express from "express";
import upload from "../middlewares/upload.js";
import { protect } from "../middlewares/auth.js";
import {
  createStatus,
  getMyStatuses,
  getFeedStatuses,
  markStatusViewed,
  deleteMyStatus,
  getStatusViewers,
  forwardStatus,
  getMyStatusPrivacy,
  updateMyStatusPrivacy,
} from "../controllers/statusController.js";

const router = express.Router();

router.post("/", protect, upload.array("attachments", 5), createStatus);
router.get("/mine", protect, getMyStatuses);
router.get("/feed", protect, getFeedStatuses);
router.get("/privacy", protect, getMyStatusPrivacy);
router.put("/privacy", protect, updateMyStatusPrivacy);
router.get("/:statusId/views", protect, getStatusViewers);
router.post("/:statusId/forward", protect, forwardStatus);
router.post("/:statusId/view", protect, markStatusViewed);
router.delete("/:statusId", protect, deleteMyStatus);

export default router;
