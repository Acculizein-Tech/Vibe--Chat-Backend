import express from "express";
import { sendMessage, getMessages,editMessage, deleteMessage  } from "../controllers/messageController.js";
import { protect } from "../middlewares/auth.js";
const router = express.Router();

router.post("/", protect, sendMessage);
router.get("/:conversationId", getMessages);

// ✅ Edit & delete
router.put("/edit/:messageId", protect, editMessage);
router.delete("/delete/:messageId", protect, deleteMessage);

export default router;
