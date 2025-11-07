import express from "express";
import {
  getOrCreateConversation,
  getUserConversations,
  getChatUsers,
} from "../controllers/conversationController.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

router.get("/chatusers", protect, getChatUsers);
router.post("/", protect, getOrCreateConversation);
router.get("/:userId", protect, getUserConversations);

export default router;
