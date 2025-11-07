import express from "express";
import {
  getOrCreateConversation,
  getUserConversations,
} from "../controllers/conversationController.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

router.post("/", protect, getOrCreateConversation);
router.get("/:userId", protect, getUserConversations);

export default router;
