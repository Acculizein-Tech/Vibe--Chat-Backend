import express from "express";
import { protect } from "../middlewares/auth.js";
import {
  createGroupConversation,
  getGroupConversations,
  getGroupConversationById,
  updateGroupConversation,
  deleteGroupConversation,
  addGroupMembers,
  removeGroupMember,
  updateGroupMemberRole,
  leaveGroupConversation,
} from "../controllers/groupConversationController.js";

const router = express.Router();

router.post("/", protect, createGroupConversation);
router.get("/", protect, getGroupConversations);
router.get("/:groupConversationId", protect, getGroupConversationById);
router.put("/:groupConversationId", protect, updateGroupConversation);
router.delete("/:groupConversationId", protect, deleteGroupConversation);
router.post("/:groupConversationId/leave", protect, leaveGroupConversation);
router.post("/:groupConversationId/members", protect, addGroupMembers);
router.delete(
  "/:groupConversationId/members/:memberId",
  protect,
  removeGroupMember,
);
router.patch(
  "/:groupConversationId/members/:memberId/role",
  protect,
  updateGroupMemberRole,
);

export default router;
