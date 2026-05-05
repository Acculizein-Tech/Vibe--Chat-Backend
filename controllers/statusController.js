import asyncHandler from "../utils/asyncHandler.js";
import Status from "../models/Status.js";
import StatusView from "../models/StatusView.js";
import User from "../models/user.js";
import { uploadToS3 } from "../middlewares/upload.js";
import Conversation from "../models/Conversation.js";
import GroupConversation from "../models/GroupConversation.js";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

const STATUS_LIFETIME_MS = 24 * 60 * 60 * 1000;

const normalizeId = (value) => String(value || "").trim();
const toObjectIdString = (value) => normalizeId(value);

const isAllowedMedia = (mime = "") => {
  const type = String(mime || "").toLowerCase();
  return type.startsWith("image/") || type.startsWith("video/");
};

const getMediaKind = (mime = "") => {
  const type = String(mime || "").toLowerCase();
  return type.startsWith("video/") ? "video" : "image";
};

const getNow = () => new Date();

const getActiveStatusMatch = () => ({
  expiresAt: { $gt: getNow() },
});

const parseTextStyleInput = (raw) => {
  if (!raw) return null;
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const theme = parsed.theme && typeof parsed.theme === "object" ? parsed.theme : {};
  const safe = {
    theme: {
      bg: String(theme.bg || "").slice(0, 20),
      card: String(theme.card || "").slice(0, 20),
      glow: String(theme.glow || "").slice(0, 20),
      accent: String(theme.accent || "").slice(0, 20),
    },
    fontSize: Math.max(12, Math.min(72, Number(parsed.fontSize || 0) || 0)),
    fontWeight: String(parsed.fontWeight || "").slice(0, 10),
    fontStyle: String(parsed.fontStyle || "").slice(0, 10),
    textAlign: String(parsed.textAlign || "").slice(0, 10),
    letterSpacing: Number(parsed.letterSpacing || 0) || 0,
    fontFamily: String(parsed.fontFamily || "").slice(0, 60),
    presetKey: String(parsed.presetKey || "").slice(0, 30),
    emotionKey: String(parsed.emotionKey || "").slice(0, 30),
    useCustomTheme: Boolean(parsed.useCustomTheme),
  };
  return safe;
};

const parseTrimRangesInput = (raw) => {
  if (!raw) return [];
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) => {
    const startRatio = Math.max(0, Math.min(1, Number(item?.startRatio ?? 0)));
    const endRatio = Math.max(0, Math.min(1, Number(item?.endRatio ?? 1)));
    return { startRatio, endRatio };
  });
};

const parseMediaCaptionsInput = (raw) => {
  if (!raw) return [];
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) => String(item || "").trim().slice(0, 700));
};

const parseStatusPrivacyInput = (raw) => {
  if (!raw) return null;
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const mode = String(parsed?.mode || "").toLowerCase();
  const safeMode = ["my_contacts", "contacts_except", "only_share_with"].includes(mode)
    ? mode
    : "my_contacts";
  const exceptUserIds = Array.isArray(parsed?.exceptUserIds)
    ? parsed.exceptUserIds.map((id) => toObjectIdString(id)).filter(Boolean)
    : [];
  const onlyShareWithUserIds = Array.isArray(parsed?.onlyShareWithUserIds)
    ? parsed.onlyShareWithUserIds.map((id) => toObjectIdString(id)).filter(Boolean)
    : [];
  return { mode: safeMode, exceptUserIds, onlyShareWithUserIds };
};

const runCmd = (bin, args) =>
  new Promise((resolve, reject) => {
    const cp = spawn(bin, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    cp.stdout?.on("data", (d) => {
      stdout += String(d || "");
    });
    cp.stderr?.on("data", (d) => {
      stderr += String(d || "");
    });
    cp.on("error", reject);
    cp.on("close", (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      const err = new Error(`${bin} failed with code ${code}: ${stderr || stdout}`);
      err.code = code;
      reject(err);
    });
  });

const getVideoDurationSec = async (inputPath) => {
  const ffprobeBin = process.env.FFPROBE_PATH || "ffprobe";
  const out = await runCmd(ffprobeBin, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputPath,
  ]);
  const duration = Number(String(out?.stdout || "").trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Unable to read video duration");
  }
  return duration;
};

const trimVideoBuffer = async (file, startRatio, endRatio) => {
  const safeStart = Math.max(0, Math.min(1, Number(startRatio || 0)));
  const safeEnd = Math.max(0, Math.min(1, Number(endRatio || 1)));
  const needsTrim = safeStart > 0.001 || safeEnd < 0.999;
  if (!needsTrim) return file;
  if (safeEnd - safeStart < 0.03) {
    throw new Error("Trim range is too small");
  }

  const ffmpegBin = process.env.FFMPEG_PATH || "ffmpeg";
  const ext = path.extname(String(file?.originalname || "")).toLowerCase() || ".mp4";
  const tempBase = `status-trim-${Date.now()}-${randomUUID()}`;
  const inputPath = path.join(os.tmpdir(), `${tempBase}-in${ext}`);
  const outputPath = path.join(os.tmpdir(), `${tempBase}-out.mp4`);

  try {
    await fs.writeFile(inputPath, file.buffer);
    const totalSec = await getVideoDurationSec(inputPath);
    const startSec = Math.max(0, totalSec * safeStart);
    const trimSec = Math.max(0.12, totalSec * (safeEnd - safeStart));

    // Re-encode for stable cross-device output.
    await runCmd(ffmpegBin, [
      "-y",
      "-ss",
      `${startSec}`,
      "-i",
      inputPath,
      "-t",
      `${trimSec}`,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    const outBuffer = await fs.readFile(outputPath);
    return {
      ...file,
      originalname: String(file?.originalname || "status-video").replace(/\.[^.]+$/, "") + "-trimmed.mp4",
      mimetype: "video/mp4",
      buffer: outBuffer,
      size: outBuffer.length,
    };
  } finally {
    await Promise.allSettled([
      fs.unlink(inputPath),
      fs.unlink(outputPath),
    ]);
  }
};

const getContactUserIds = async (currentUserId) => {
  const user = await User.findById(currentUserId).select("blockedUsers").lean();
  const blockedByMe = Array.isArray(user?.blockedUsers)
    ? user.blockedUsers.map((id) => toObjectIdString(id))
    : [];

  const [directConversations, groupConversations] = await Promise.all([
    Conversation.find({ participants: currentUserId }).select("participants").lean(),
    GroupConversation.find({ participants: currentUserId }).select("participants").lean(),
  ]);

  const contactIds = new Set();
  [...directConversations, ...groupConversations].forEach((conv) => {
    (conv?.participants || []).forEach((id) => {
      const sid = toObjectIdString(id);
      if (sid && sid !== toObjectIdString(currentUserId)) {
        contactIds.add(sid);
      }
    });
  });

  const filteredUsers = await User.find({
    _id: { $in: Array.from(contactIds) },
    blockedUsers: { $nin: [currentUserId] },
  })
    .select("_id blockedUsers")
    .lean();

  return (filteredUsers || [])
    .map((u) => toObjectIdString(u?._id))
    .filter((id) => id && !blockedByMe.includes(id));
};

const emitStatusChanged = ({ req, actorUserId, extraUserIds = [], reason = "updated" }) => {
  const io = req?.app?.get?.("io");
  if (!io) return;
  const targets = new Set(
    [toObjectIdString(actorUserId), ...extraUserIds.map((id) => toObjectIdString(id))]
      .filter(Boolean),
  );
  for (const uid of targets) {
    io.to(`user:${uid}`).emit("status:changed", {
      userId: uid,
      actorUserId: toObjectIdString(actorUserId),
      reason,
      at: new Date().toISOString(),
    });
  }
};

export const createStatus = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const text = String(req.body?.text || "").trim();
  const visibility = String(req.body?.visibility || "contacts").toLowerCase();
  const textStyle = parseTextStyleInput(req.body?.textStyle);
  const trimRanges = parseTrimRangesInput(req.body?.trimRanges);
  const mediaCaptions = parseMediaCaptionsInput(req.body?.mediaCaptions);
  const incomingPrivacy = parseStatusPrivacyInput(req.body?.statusPrivacy);
  const files = Array.isArray(req.files) ? req.files : [];

  if (!text && files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Text or media is required",
    });
  }

  if (!["contacts", "all"].includes(visibility)) {
    return res.status(400).json({
      success: false,
      message: "Invalid visibility",
    });
  }

  const media = [];
  for (let idx = 0; idx < files.length; idx += 1) {
    const file = files[idx];
    if (!isAllowedMedia(file?.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Only image/video are allowed for status",
      });
    }
    let uploadFile = file;
    const isVideo = String(file?.mimetype || "").toLowerCase().startsWith("video/");
    const trim = trimRanges[idx] || { startRatio: 0, endRatio: 1 };
    if (isVideo) {
      const wantsTrim =
        Number(trim?.startRatio || 0) > 0.001 ||
        Number(trim?.endRatio || 1) < 0.999;
      if (wantsTrim) {
        try {
          uploadFile = await trimVideoBuffer(file, trim.startRatio, trim.endRatio);
        } catch (trimErr) {
          console.error("Status video trim failed:", trimErr?.message || trimErr);
          return res.status(422).json({
            success: false,
            message: "Video trim failed. Please adjust trim range or try another video.",
          });
        }
      }
    }

    const uploaded = await uploadToS3(uploadFile, req);
    if (!uploaded?.success || !uploaded?.url) {
      return res.status(500).json({
        success: false,
        message: uploaded?.message || "Status upload failed",
      });
    }
    const mediaCaption = String(mediaCaptions[idx] || "").trim().slice(0, 700);
    media.push({
      url: uploaded.url,
      type: getMediaKind(uploadFile?.mimetype || file?.mimetype),
      mimeType: String(uploadFile?.mimetype || file?.mimetype || ""),
      fileName: String(uploadFile?.originalname || file?.originalname || ""),
      sizeBytes: Number(uploadFile?.size || file?.size || 0) || null,
      thumbnailUrl: String(uploaded?.thumbnailUrl || ""),
      caption: mediaCaption,
    });
  }

  const firstMediaCaption = String(
    media.find((m) => String(m?.caption || "").trim())?.caption || "",
  ).trim();
  const resolvedText = text || firstMediaCaption;
  const owner = await User.findById(userId).select("statusPrivacy").lean();
  const ownerPrivacy = owner?.statusPrivacy || {};
  const privacySnapshot = incomingPrivacy || {
    mode: String(ownerPrivacy?.mode || "my_contacts"),
    exceptUserIds: Array.isArray(ownerPrivacy?.exceptUserIds) ? ownerPrivacy.exceptUserIds.map((id) => toObjectIdString(id)).filter(Boolean) : [],
    onlyShareWithUserIds: Array.isArray(ownerPrivacy?.onlyShareWithUserIds) ? ownerPrivacy.onlyShareWithUserIds.map((id) => toObjectIdString(id)).filter(Boolean) : [],
  };

  const createdAt = getNow();
  const status = await Status.create({
    user: userId,
    text: resolvedText,
    textStyle: textStyle || undefined,
    media,
    visibility,
    privacySnapshot,
    expiresAt: new Date(createdAt.getTime() + STATUS_LIFETIME_MS),
    createdAt,
    updatedAt: createdAt,
  });

  const populated = await Status.findById(status._id)
    .populate("user", "fullName profile.photo profile.avatar")
    .lean();

  const contactIds = await getContactUserIds(userId);
  emitStatusChanged({
    req,
    actorUserId: userId,
    extraUserIds: contactIds,
    reason: "created",
  });

  return res.status(201).json({
    success: true,
    status: populated,
  });
});

export const getMyStatuses = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const statuses = await Status.find({
    user: userId,
    ...getActiveStatusMatch(),
  })
    .sort({ createdAt: -1 })
    .populate("user", "fullName profile.photo profile.avatar")
    .lean();

  const statusIds = statuses.map((s) => s?._id).filter(Boolean);
  const viewCounts = statusIds.length
    ? await StatusView.aggregate([
        { $match: { status: { $in: statusIds } } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ])
    : [];
  const countMap = new Map(
    viewCounts.map((v) => [toObjectIdString(v?._id), Number(v?.count || 0)]),
  );
  const withCounts = statuses.map((s) => ({
    ...s,
    viewCount: countMap.get(toObjectIdString(s?._id)) || 0,
  }));

  return res.status(200).json({ success: true, statuses: withCounts });
});

export const getFeedStatuses = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const contactIds = await getContactUserIds(userId);
  const viewerId = toObjectIdString(userId);

  const statuses = await Status.find({
    user: { $in: contactIds },
    ...getActiveStatusMatch(),
    $or: [{ visibility: "all" }, { visibility: "contacts" }],
  })
    .sort({ createdAt: -1 })
    .populate("user", "fullName profile.photo profile.avatar")
    .lean();

  const filteredStatuses = (Array.isArray(statuses) ? statuses : []).filter((status) => {
    const snap = status?.privacySnapshot || {};
    const mode = String(snap?.mode || "my_contacts");
    const except = Array.isArray(snap?.exceptUserIds) ? snap.exceptUserIds.map((id) => toObjectIdString(id)) : [];
    const only = Array.isArray(snap?.onlyShareWithUserIds) ? snap.onlyShareWithUserIds.map((id) => toObjectIdString(id)) : [];
    if (mode === "contacts_except") {
      return !except.includes(viewerId);
    }
    if (mode === "only_share_with") {
      return only.includes(viewerId);
    }
    return true;
  });

  const statusIds = filteredStatuses.map((s) => s._id);
  const viewed = await StatusView.find({
    status: { $in: statusIds },
    viewer: userId,
  })
    .select("status")
    .lean();
  const viewedSet = new Set(viewed.map((v) => toObjectIdString(v.status)));

  const groupedMap = new Map();
  for (const status of filteredStatuses) {
    const uid = toObjectIdString(status.user?._id);
    if (!uid) continue;
    if (!groupedMap.has(uid)) {
      groupedMap.set(uid, {
        user: status.user,
        items: [],
        hasUnseen: false,
        lastCreatedAt: status.createdAt,
      });
    }
    const group = groupedMap.get(uid);
    const isSeen = viewedSet.has(toObjectIdString(status._id));
    group.items.push({ ...status, seen: isSeen });
    if (!isSeen) group.hasUnseen = true;
    if (new Date(status.createdAt) > new Date(group.lastCreatedAt)) {
      group.lastCreatedAt = status.createdAt;
    }
  }

  const groups = Array.from(groupedMap.values()).sort(
    (a, b) => new Date(b.lastCreatedAt) - new Date(a.lastCreatedAt),
  );

  return res.status(200).json({ success: true, groups });
});

export const getMyStatusPrivacy = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const user = await User.findById(userId).select("statusPrivacy").lean();
  const snap = user?.statusPrivacy || {};
  return res.status(200).json({
    success: true,
    privacy: {
      mode: String(snap?.mode || "my_contacts"),
      exceptUserIds: Array.isArray(snap?.exceptUserIds) ? snap.exceptUserIds.map((id) => toObjectIdString(id)).filter(Boolean) : [],
      onlyShareWithUserIds: Array.isArray(snap?.onlyShareWithUserIds) ? snap.onlyShareWithUserIds.map((id) => toObjectIdString(id)).filter(Boolean) : [],
    },
  });
});

export const updateMyStatusPrivacy = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const parsed = parseStatusPrivacyInput(req.body?.statusPrivacy || req.body);
  if (!parsed) {
    return res.status(400).json({ success: false, message: "Invalid privacy payload" });
  }
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        "statusPrivacy.mode": parsed.mode,
        "statusPrivacy.exceptUserIds": parsed.exceptUserIds,
        "statusPrivacy.onlyShareWithUserIds": parsed.onlyShareWithUserIds,
      },
    },
  );
  return res.status(200).json({ success: true, privacy: parsed });
});

export const markStatusViewed = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const statusId = req.params?.statusId;
  const status = await Status.findOne({
    _id: statusId,
    ...getActiveStatusMatch(),
  })
    .select("_id user")
    .lean();

  if (!status) {
    return res.status(404).json({ success: false, message: "Status not found" });
  }

  if (toObjectIdString(status.user) !== toObjectIdString(userId)) {
    await StatusView.updateOne(
      { status: statusId, viewer: userId },
      { $setOnInsert: { viewedAt: getNow() } },
      { upsert: true },
    );
  }

  emitStatusChanged({
    req,
    actorUserId: userId,
    extraUserIds: [status.user],
    reason: "viewed",
  });

  return res.status(200).json({ success: true });
});

export const deleteMyStatus = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const statusId = req.params?.statusId;
  const existing = await Status.findOne({ _id: statusId, user: userId }).lean();
  if (!existing) {
    return res.status(404).json({
      success: false,
      message: "Status not found",
    });
  }

  await Promise.all([
    Status.deleteOne({ _id: statusId, user: userId }),
    StatusView.deleteMany({ status: statusId }),
  ]);
  const contactIds = await getContactUserIds(userId);
  emitStatusChanged({
    req,
    actorUserId: userId,
    extraUserIds: contactIds,
    reason: "deleted",
  });
  return res.status(200).json({ success: true });
});

export const getStatusViewers = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const statusId = req.params?.statusId;
  const owned = await Status.findOne({ _id: statusId, user: userId })
    .select("_id")
    .lean();
  if (!owned) {
    return res.status(404).json({ success: false, message: "Status not found" });
  }

  const views = await StatusView.find({ status: statusId })
    .sort({ viewedAt: -1, createdAt: -1 })
    .populate("viewer", "fullName profile.photo profile.avatar")
    .lean();

  const viewers = (Array.isArray(views) ? views : []).map((v) => ({
    _id: toObjectIdString(v?._id),
    viewedAt: v?.viewedAt || v?.createdAt || null,
    user: {
      _id: toObjectIdString(v?.viewer?._id),
      fullName: v?.viewer?.fullName || "User",
      profile: {
        photo: v?.viewer?.profile?.photo || "",
        avatar: v?.viewer?.profile?.avatar || "",
      },
    },
  }));

  return res.status(200).json({ success: true, viewers });
});

export const forwardStatus = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const statusId = req.params?.statusId;
  const source = await Status.findOne({
    _id: statusId,
    ...getActiveStatusMatch(),
  }).lean();
  if (!source) {
    return res.status(404).json({ success: false, message: "Status not found" });
  }

  const createdAt = getNow();
  const created = await Status.create({
    user: userId,
    text: String(source?.text || ""),
    textStyle: source?.textStyle || undefined,
    media: Array.isArray(source?.media) ? source.media : [],
    visibility: "contacts",
    expiresAt: new Date(createdAt.getTime() + STATUS_LIFETIME_MS),
    createdAt,
    updatedAt: createdAt,
  });

  const populated = await Status.findById(created._id)
    .populate("user", "fullName profile.photo profile.avatar")
    .lean();
  const contactIds = await getContactUserIds(userId);
  emitStatusChanged({
    req,
    actorUserId: userId,
    extraUserIds: contactIds,
    reason: "forwarded",
  });

  return res.status(201).json({ success: true, status: populated });
});
