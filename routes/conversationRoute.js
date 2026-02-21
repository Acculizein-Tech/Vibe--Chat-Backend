import express from "express";
import upload from "../middlewares/upload.js";
import {
  getOrCreateConversation,
  getUserConversations,
  getChatUsers,
  deleteConversation,
  createGroupConversation,
} from "../controllers/conversationController.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

router.get("/chatusers", protect, getChatUsers);
router.post("/", protect, getOrCreateConversation);
router.post("/group", protect, createGroupConversation);
router.get("/:userId", protect, getUserConversations);
router.delete("/delete-conversation/:conversationId", protect, deleteConversation)


export default router;
