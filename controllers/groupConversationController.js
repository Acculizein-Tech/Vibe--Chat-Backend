import mongoose from "mongoose";
import GroupConversation from "../models/GroupConversation.js";
import Message from "../models/Message.js";
import { onlineUsers } from "../utils/socketState.js";
import { decryptMessageText } from "../utils/messageCrypto.js";
const GROUP_CONVERSATIONS_CACHE_TTL_MS = 0;
const groupConversationsCache = new Map();
const mediaPreviewLabel = (media = []) => {
  const list = Array.isArray(media) ? media : [];
  if (!list.length) return "";
  const firstType = String(list[0]?.type || "").trim().toLowerCase();
  if (firstType === "image") return list.length > 1 ? "Photos" : "Photo";
  if (firstType === "video") return list.length > 1 ? "Videos" : "Video";
  if (firstType === "audio") return list.length > 1 ? "Audios" : "Audio";
  return list.length > 1 ? "Documents" : "Document";
};
const isGenericMediaLabel = (value = "") => {
  const normalized = String(value || "")
    .trim()
    .replace(/^forwarded\s*:?\s*/i, "")
    .toLowerCase();
  if (!normalized) return false;
  return [
    "photo",
    "photos",
    "image",
    "images",
    "video",
    "videos",
    "audio",
    "audios",
    "document",
    "documents",
    "file",
    "files",
    "pdf",
  ].includes(normalized);
};

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));
const isObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

const uniqueValidIds = (ids = []) =>
  Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((id) => String(id || "").trim())
        .filter((id) => isObjectId(id)),
    ),
  );

const populateGroup = (query) =>
  query
    .populate(
      "participants",
      "fullName phone username profile.avatar accountType businessProfile",
    )
    .populate(
      "createdBy",
      "fullName phone username profile.avatar accountType businessProfile",
    )
    .populate(
      "admins",
      "fullName phone username profile.avatar accountType businessProfile",
    );

const isAdminUser = (group, userId) => {
  const me = String(userId || "");
  const creatorId =
    typeof group.createdBy === "object"
      ? String(group.createdBy?._id || "")
      : String(group.createdBy || "");
  if (creatorId === me) return true;
  return (group.admins || []).some((a) => String(a?._id || a) === me);
};

const emitToUser = (io, userId, event, payload) => {
  const uid = String(userId || "");
  if (!uid || !io) return;
  io.to(`user:${uid}`).emit(event, payload);
  const sid = onlineUsers.get(uid);
  if (sid) io.to(sid).emit(event, payload);
};

const deleteGroupConversationInternal = async ({
  groupConversationId,
  userId,
  io,
}) => {
  if (!mongoose.Types.ObjectId.isValid(groupConversationId)) {
    return { ok: false, reason: "Invalid groupConversationId" };
  }

  const groupConversation = await GroupConversation.findById(
    groupConversationId,
  );
  if (!groupConversation) {
    return { ok: false, reason: "Group conversation not found" };
  }

  const isCreator = String(groupConversation.createdBy) === String(userId);
  if (!isCreator) {
    return { ok: false, reason: "Only creator can delete this group" };
  }

  const hydrated = await populateGroup(
    GroupConversation.findById(groupConversationId),
  );
  io?.to(String(groupConversationId)).emit("group:inchat:event", {
    conversationId: String(groupConversationId),
    action: "group:dismissed",
    text: "Group dismissed",
    createdAt: new Date().toISOString(),
    removed: true,
    type: "group",
  });

  await GroupConversation.findByIdAndDelete(groupConversationId);

  const removedFor = extractParticipantIds(hydrated);
  removedFor.forEach((uid) => {
    emitToUser(io, uid, "group:inchat:event", {
      conversationId: String(groupConversationId),
      action: "group:dismissed",
      text: "Group dismissed",
      createdAt: new Date().toISOString(),
      removed: true,
      type: "group",
      targetUserId: String(uid),
    });
    emitToUser(io, uid, "chat:list:refresh", {
      conversationId: String(groupConversationId),
      action: "group:dismissed",
      text: "Group dismissed",
      createdAt: new Date().toISOString(),
      removed: true,
      type: "group",
    });
    emitToUser(io, uid, "chat:list:patch", {
      conversationId: String(groupConversationId),
      action: "group:dismissed",
      text: "Group dismissed",
      createdAt: new Date().toISOString(),
      removed: true,
      type: "group",
    });
  });

  return { ok: true };
};

const extractParticipantIds = (groupConversation) =>
  (groupConversation?.participants || [])
    .map((p) => String(p?._id || p || ""))
    .filter(Boolean);

const emitGroupSidebarSync = ({
  io,
  groupConversation,
  action,
  text,
  removedFor = [],
  removedText = "",
}) => {
  if (!io || !groupConversation?._id) return;
  const conversationId = String(groupConversation._id);
  const payload = {
    conversationId,
    action,
    text: String(text || ""),
    createdAt: new Date().toISOString(),
    name: String(groupConversation.groupName || ""),
    avatar: String(groupConversation.groupAvatar || ""),
    type: "group",
  };

  io.to(conversationId).emit("group:inchat:event", payload);

  const participantIds = extractParticipantIds(groupConversation);
  participantIds.forEach((uid) => {
    emitToUser(io, uid, "chat:list:refresh", payload);
    emitToUser(io, uid, "chat:list:patch", payload);
  });

  (removedFor || []).forEach((uid) => {
    emitToUser(io, uid, "group:inchat:event", {
      ...payload,
      text: String(removedText || text || ""),
      removed: true,
      targetUserId: String(uid),
    });
    emitToUser(io, uid, "chat:list:refresh", {
      ...payload,
      removed: true,
    });
    emitToUser(io, uid, "chat:list:patch", {
      ...payload,
      removed: true,
    });
  });
};

export const createGroupConversation = async (req, res) => {
  try {
    const creatorId = req.user?._id;
    const { participantIds = [], groupName = "", groupAvatar = "" } = req.body || {};

    if (!creatorId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const cleanName = String(groupName || "").trim();
    if (!cleanName) {
      return res.status(400).json({ message: "Group name is required" });
    }

    const validParticipantIds = uniqueValidIds(participantIds);

    const participants = Array.from(
      new Set([String(creatorId), ...validParticipantIds]),
    ).map(toObjectId);

    if (participants.length < 2) {
      return res.status(400).json({
        message: "At least one valid participant is required to create group",
      });
    }

    const groupConversation = await GroupConversation.create({
      participants,
      groupName: cleanName,
      groupAvatar: String(groupAvatar || ""),
      createdBy: creatorId,
      admins: [creatorId],
      status: "active",
    });

    const io = req.app.get("io");
    const hydrated = await populateGroup(
      GroupConversation.findById(groupConversation._id),
    );
    const creatorName =
      hydrated?.createdBy?.fullName ||
      hydrated?.createdBy?.username ||
      hydrated?.createdBy?.phone ||
      "Someone";
    emitGroupSidebarSync({
      io,
      groupConversation: hydrated,
      action: "group:created",
      text: `Group created by ${creatorName}`,
    });

    return res.status(201).json({
      message: "Group conversation created",
      groupConversation: hydrated,
    });
  } catch (error) {
    console.error("createGroupConversation error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getGroupConversations = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const cacheKey = String(userId || "");
    const now = Date.now();
    const cached = groupConversationsCache.get(cacheKey);
    if (cached && now - cached.ts < GROUP_CONVERSATIONS_CACHE_TTL_MS) {
      return res.status(200).json(cached.payload);
    }

    const groupsRaw = await populateGroup(
      GroupConversation.find({
        participants: userId,
      }).sort({ updatedAt: -1 }),
    ).lean();

    const cache = new Map();
    const lastMessageIds = Array.from(
      new Set(
        (groupsRaw || [])
          .map((group) => String(group?.lastMessage || ""))
          .filter((id) => mongoose.Types.ObjectId.isValid(id)),
      ),
    );
    const lastMessages = lastMessageIds.length
      ? await Message.find({ _id: { $in: lastMessageIds } })
          .select(
            "text encryptedText textIv textAuthTag isEncrypted conversationId createdAt sender receiver media",
          )
          .lean()
      : [];
    const lastMessageById = new Map(
      (lastMessages || []).map((msg) => [String(msg?._id || ""), msg]),
    );

    const groups = await Promise.all(
      (groupsRaw || []).map(async (group) => {
        let lastMessageDoc = null;
        const lastMessageId = String(group?.lastMessage || "");

        if (lastMessageId && mongoose.Types.ObjectId.isValid(lastMessageId)) {
          lastMessageDoc = lastMessageById.get(lastMessageId) || null;
        }

        const lastMessageText = lastMessageDoc
          ? await decryptMessageText(lastMessageDoc, cache)
          : null;
        const lastMessageTextValue = String(lastMessageText || "").trim();
        const mediaPreview = mediaPreviewLabel(lastMessageDoc?.media);
        const lastMessagePreview =
          mediaPreview && isGenericMediaLabel(lastMessageTextValue)
            ? mediaPreview
            : lastMessageTextValue || mediaPreview;

        return {
          ...group,
          lastMessage: lastMessageDoc
            ? {
                ...lastMessageDoc,
                text: lastMessageText,
              }
            : null,
          lastMessageText: lastMessagePreview || null,
          lastMessageAt:
            lastMessageDoc?.createdAt || group?.updatedAt || group?.createdAt || null,
        };
      }),
    );

    const chatUsers = groups.map((group) => {
      const createdByName =
        group?.createdBy?.fullName ||
        group?.createdBy?.username ||
        group?.createdBy?.phone ||
        "Unknown";

      return {
        conversationId: group?._id,
        type: "group",
        participant: {
          receiver: null,
          fullName: group?.groupName || "Unnamed Group",
          phone: "",
          userImages: [],
          profileAvatar: group?.groupAvatar || null,
          existingName: null,
          existingUserId: null,
          lastMessage: group?.lastMessageText || null,
          lastMessageAt: group?.lastMessageAt || null,
          groupCreatedBy: createdByName,
        },
      };
    });

    const payload = {
      status: "Success",
      groupConversations: groups,
      chatUsers,
    };
    groupConversationsCache.set(cacheKey, { ts: now, payload });
    return res.status(200).json(payload);
  } catch (error) {
    console.error("getGroupConversations error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getGroupConversationById = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { groupConversationId } = req.params;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!mongoose.Types.ObjectId.isValid(groupConversationId)) {
      return res.status(400).json({ message: "Invalid groupConversationId" });
    }

    const groupConversation = await populateGroup(
      GroupConversation.findById(groupConversationId),
    );

    if (!groupConversation) {
      return res.status(404).json({ message: "Group conversation not found" });
    }

    const isParticipant = groupConversation.participants.some(
      (p) => String(p._id || p) === String(userId),
    );
    if (!isParticipant) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    return res.status(200).json({ status: "Success", groupConversation });
  } catch (error) {
    console.error("getGroupConversationById error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const updateGroupConversation = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { groupConversationId } = req.params;
    const { groupName, groupAvatar, participantIds, status } = req.body || {};

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!mongoose.Types.ObjectId.isValid(groupConversationId)) {
      return res.status(400).json({ message: "Invalid groupConversationId" });
    }

    const groupConversation = await GroupConversation.findById(groupConversationId);
    if (!groupConversation) {
      return res.status(404).json({ message: "Group conversation not found" });
    }

    const isParticipant = groupConversation.participants.some(
      (p) => String(p) === String(userId),
    );
    if (!isParticipant || !isAdminUser(groupConversation, userId)) {
      return res
        .status(403)
        .json({ message: "Only group admins can update this group" });
    }

    if (typeof groupName === "string" && groupName.trim()) {
      groupConversation.groupName = groupName.trim();
    }
    if (typeof groupAvatar === "string") {
      groupConversation.groupAvatar = groupAvatar.trim();
    }
    if (typeof status === "string" && ["active", "pending", "closed"].includes(status)) {
      groupConversation.status = status;
    }
    if (Array.isArray(participantIds)) {
      const validIds = uniqueValidIds(participantIds);
      groupConversation.participants = Array.from(
        new Set([String(groupConversation.createdBy), ...validIds]),
      ).map(toObjectId);
      groupConversation.admins = Array.from(
        new Set(
          (groupConversation.admins || [])
            .map((id) => String(id))
            .filter((id) =>
              groupConversation.participants.some((p) => String(p) === id),
            )
            .concat([String(groupConversation.createdBy)]),
        ),
      ).map(toObjectId);
    }

    await groupConversation.save();
    const hydrated = await populateGroup(
      GroupConversation.findById(groupConversation._id),
    );
    const io = req.app.get("io");
    emitGroupSidebarSync({
      io,
      groupConversation: hydrated,
      action: "group:updated",
      text: "Group info updated",
    });
    return res.status(200).json({
      message: "Group conversation updated",
      groupConversation: hydrated,
    });
  } catch (error) {
    console.error("updateGroupConversation error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const leaveGroupConversation = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { groupConversationId } = req.params;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!isObjectId(groupConversationId)) {
      return res.status(400).json({ message: "Invalid groupConversationId" });
    }

    const groupConversation = await GroupConversation.findById(groupConversationId);
    if (!groupConversation) {
      return res.status(404).json({ message: "Group conversation not found" });
    }

    const isParticipant = groupConversation.participants.some(
      (p) => String(p) === String(userId),
    );
    if (!isParticipant) {
      return res.status(403).json({ message: "Not a group participant" });
    }

    if (String(groupConversation.createdBy) === String(userId)) {
      return res.status(400).json({
        message: "Group creator cannot leave. Dismiss group instead.",
      });
    }

    const leavingUserId = String(userId);
    groupConversation.participants = groupConversation.participants.filter(
      (p) => String(p) !== String(userId),
    );
    groupConversation.admins = (groupConversation.admins || []).filter(
      (a) => String(a) !== String(userId),
    );
    await groupConversation.save();
    const io = req.app.get("io");
    const hydrated = await populateGroup(
      GroupConversation.findById(groupConversation._id),
    );
    emitGroupSidebarSync({
      io,
      groupConversation: hydrated,
      action: "group:left",
      text: "A member left the group",
      removedFor: [leavingUserId],
      removedText: "You left the group",
    });

    return res.status(200).json({
      message: "Left group successfully",
      groupConversationId: String(groupConversation._id),
    });
  } catch (error) {
    console.error("leaveGroupConversation error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const deleteGroupConversation = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { groupConversationId } = req.params;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const io = req.app.get("io");
    const result = await deleteGroupConversationInternal({
      groupConversationId,
      userId,
      io,
    });
    if (!result.ok) {
      const status =
        result.reason === "Invalid groupConversationId"
          ? 400
          : result.reason === "Group conversation not found"
            ? 404
            : result.reason === "Only creator can delete this group"
              ? 403
              : 400;
      return res.status(status).json({ message: result.reason });
    }
    return res
      .status(200)
      .json({ message: "Group conversation deleted successfully" });
  } catch (error) {
    console.error("deleteGroupConversation error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const deleteGroupConversations = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { groupConversationIds = [] } = req.body || {};
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const ids = Array.isArray(groupConversationIds)
      ? groupConversationIds
          .map((id) => String(id || "").trim())
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
      : [];
    if (!ids.length) {
      return res
        .status(400)
        .json({ message: "No valid groupConversationIds provided" });
    }

    const io = req.app.get("io");
    const deleted = [];
    const failed = [];
    for (const id of ids) {
      const result = await deleteGroupConversationInternal({
        groupConversationId: id,
        userId,
        io,
      });
      if (result.ok) {
        deleted.push(id);
      } else {
        failed.push({ id, reason: result.reason || "Failed to delete" });
      }
    }

    return res.status(200).json({
      message: "Bulk group delete completed",
      deleted,
      failed,
    });
  } catch (error) {
    console.error("deleteGroupConversations error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const addGroupMembers = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { groupConversationId } = req.params;
    const { memberIds = [] } = req.body || {};

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!isObjectId(groupConversationId)) {
      return res.status(400).json({ message: "Invalid groupConversationId" });
    }

    const groupConversation = await GroupConversation.findById(groupConversationId);
    if (!groupConversation) {
      return res.status(404).json({ message: "Group conversation not found" });
    }

    const isParticipant = groupConversation.participants.some(
      (p) => String(p) === String(userId),
    );
    if (!isParticipant) {
      return res
        .status(403)
        .json({ message: "Only group members can add members" });
    }

    const validMemberIds = uniqueValidIds(memberIds).filter(
      (id) =>
        !groupConversation.participants.some((existing) => String(existing) === id),
    );

    if (!validMemberIds.length) {
      const hydrated = await populateGroup(
        GroupConversation.findById(groupConversation._id),
      );
      return res.status(200).json({
        message: "No new members to add",
        groupConversation: hydrated,
      });
    }

    groupConversation.participants = [
      ...groupConversation.participants,
      ...validMemberIds.map(toObjectId),
    ];
    await groupConversation.save();

    const hydrated = await populateGroup(
      GroupConversation.findById(groupConversation._id),
    );
    const io = req.app.get("io");
    emitGroupSidebarSync({
      io,
      groupConversation: hydrated,
      action: "group:members-added",
      text: "New members added",
    });
    return res.status(200).json({
      message: "Members added successfully",
      groupConversation: hydrated,
    });
  } catch (error) {
    console.error("addGroupMembers error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const removeGroupMember = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { groupConversationId, memberId } = req.params;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!isObjectId(groupConversationId) || !isObjectId(memberId)) {
      return res.status(400).json({ message: "Invalid params" });
    }

    const groupConversation = await GroupConversation.findById(groupConversationId);
    if (!groupConversation) {
      return res.status(404).json({ message: "Group conversation not found" });
    }

    const isParticipant = groupConversation.participants.some(
      (p) => String(p) === String(userId),
    );
    if (!isParticipant || !isAdminUser(groupConversation, userId)) {
      return res
        .status(403)
        .json({ message: "Only group admins can remove members" });
    }

    if (String(groupConversation.createdBy) === String(memberId)) {
      return res
        .status(400)
        .json({ message: "Group creator cannot be removed" });
    }

    groupConversation.participants = groupConversation.participants.filter(
      (p) => String(p) !== String(memberId),
    );
    groupConversation.admins = (groupConversation.admins || []).filter(
      (a) => String(a) !== String(memberId),
    );
    await groupConversation.save();

    const hydrated = await populateGroup(
      GroupConversation.findById(groupConversation._id),
    );
    const io = req.app.get("io");
    emitGroupSidebarSync({
      io,
      groupConversation: hydrated,
      action: "group:member-removed",
      text: "A member was removed",
      removedFor: [String(memberId)],
      removedText: "You were removed from this group",
    });
    return res.status(200).json({
      message: "Member removed successfully",
      groupConversation: hydrated,
    });
  } catch (error) {
    console.error("removeGroupMember error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const updateGroupMemberRole = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { groupConversationId, memberId } = req.params;
    const { role } = req.body || {};

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!isObjectId(groupConversationId) || !isObjectId(memberId)) {
      return res.status(400).json({ message: "Invalid params" });
    }
    if (!["admin", "member"].includes(String(role || ""))) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const groupConversation = await GroupConversation.findById(groupConversationId);
    if (!groupConversation) {
      return res.status(404).json({ message: "Group conversation not found" });
    }

    const isCreator = String(groupConversation.createdBy) === String(userId);
    const isSelfDemoteRequest =
      String(memberId) === String(userId) && String(role) === "member";
    if (!isCreator && !isSelfDemoteRequest) {
      return res.status(403).json({
        message:
          "Only group creator can change member roles. Non-creator admins can only remove themselves as admin.",
      });
    }

    const isParticipant = groupConversation.participants.some(
      (p) => String(p) === String(memberId),
    );
    if (!isParticipant) {
      return res.status(404).json({ message: "Member not found in this group" });
    }

    if (String(groupConversation.createdBy) === String(memberId)) {
      return res.status(400).json({ message: "Creator role cannot be changed" });
    }

    const nextAdmins = new Set((groupConversation.admins || []).map(String));
    if (role === "admin") {
      nextAdmins.add(String(memberId));
    } else {
      nextAdmins.delete(String(memberId));
    }
    nextAdmins.add(String(groupConversation.createdBy));
    groupConversation.admins = Array.from(nextAdmins).map(toObjectId);
    await groupConversation.save();

    const hydrated = await populateGroup(
      GroupConversation.findById(groupConversation._id),
    );
    const io = req.app.get("io");
    emitGroupSidebarSync({
      io,
      groupConversation: hydrated,
      action: "group:role-updated",
      text: "Group roles updated",
    });
    return res.status(200).json({
      message: "Member role updated",
      groupConversation: hydrated,
    });
  } catch (error) {
    console.error("updateGroupMemberRole error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
