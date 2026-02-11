import express from "express";
import upload from "../middlewares/upload.js";
import { sendMessage, getMessages,editMessage, deleteMessage, uploadChatImages  } from "../controllers/messageController.js";
import { protect } from "../middlewares/auth.js";
const router = express.Router();

router.post("/", protect, sendMessage);
router.get("/:conversationId", getMessages);

// ✅ Edit & delete
router.put("/edit/:messageId", protect, editMessage);
router.delete("/delete/:messageId", protect, deleteMessage);
router.post("/userImage", protect, upload.array("attachments"), uploadChatImages); // Alternate route for account deletion (with userId in body)


export default router;
