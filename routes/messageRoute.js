import express from "express";
import { sendMessage, getMessages,editMessage, deleteMessage  } from "../controllers/messageController.js";

const router = express.Router();

router.post("/", sendMessage);
router.get("/:conversationId", getMessages);

// ✅ Edit & delete
router.put("/edit/:messageId", editMessage);
router.delete("/delete/:messageId", deleteMessage);

export default router;
