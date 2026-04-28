import BulkBatch from "../models/BulkBatch.js";
import User from "../models/user.js";
import asyncHandler from "../utils/asyncHandler.js";
import { parseContactsFromCsvBuffer } from "../services/bulkCsvService.js";
import { enforcePlanLimit, getUserPlanLimit } from "../middlewares/bulkPlanLimit.js";
import { getBulkMessageQueue } from "../queue/bulkQueue.js";
import { ensureRedisConnection } from "../queue/redisConnection.js";
import { buildPhoneLookupCandidates, normalizePhoneNumber } from "../utils/phoneNormalizer.js";

const BULK_JOB_DELAY_MS = Number(process.env.BULK_JOB_DELAY_MS || 300);

const toSafeString = (value) => String(value || "").trim();
const toSafeStringArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
};

const resolvePlatformReceiverByPhone = async (normalizedPhone) => {
  const parsed = normalizePhoneNumber(normalizedPhone);
  if (!parsed.isValid) return null;

  const candidates = buildPhoneLookupCandidates(parsed.e164, parsed.local);
  const direct = await User.findOne({ phone: { $in: candidates } })
    .select("_id phone")
    .lean();
  if (direct) return direct;

  const localEscaped = String(parsed.local || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return User.findOne({ phone: { $regex: `${localEscaped}$` } })
    .select("_id phone")
    .lean();
};

const filterContactsByPlatform = async (contacts = []) => {
  const cache = new Map();
  const nextContacts = [];
  let onPlatformCount = 0;
  let offPlatformCount = 0;

  for (const contact of Array.isArray(contacts) ? contacts : []) {
    const phone = String(contact?.phone || "").trim();
    if (!phone) continue;

    let receiver = cache.get(phone);
    if (receiver === undefined) {
      receiver = await resolvePlatformReceiverByPhone(phone);
      cache.set(phone, receiver || null);
    }

    if (receiver?._id) {
      onPlatformCount += 1;
      nextContacts.push({
        ...contact,
        status: "pending",
        error: "",
      });
      continue;
    }

    offPlatformCount += 1;
    nextContacts.push({
      ...contact,
      status: "filtered",
      error: "Contact not available on platform",
    });
  }

  return { contacts: nextContacts, onPlatformCount, offPlatformCount };
};

const revalidatePendingContactsForPlatform = async (contacts = []) => {
  const cache = new Map();
  const nextContacts = [];
  const eligibleContacts = [];
  let newlyFiltered = 0;

  for (const contact of Array.isArray(contacts) ? contacts : []) {
    const current = {
      ...(typeof contact?.toObject === "function" ? contact.toObject() : contact),
    };
    const currentStatus = String(current?.status || "").toLowerCase();
    if (currentStatus !== "pending") {
      nextContacts.push(current);
      continue;
    }

    const phone = String(current?.phone || "").trim();
    if (!phone) {
      newlyFiltered += 1;
      nextContacts.push({
        ...current,
        status: "filtered",
        error: "Invalid phone number",
      });
      continue;
    }

    let receiver = cache.get(phone);
    if (receiver === undefined) {
      receiver = await resolvePlatformReceiverByPhone(phone);
      cache.set(phone, receiver || null);
    }

    if (!receiver?._id) {
      newlyFiltered += 1;
      nextContacts.push({
        ...current,
        status: "filtered",
        error: "Contact not available on platform",
      });
      continue;
    }

    nextContacts.push({
      ...current,
      status: "pending",
      error: "",
    });
    eligibleContacts.push(current);
  }

  return { nextContacts, eligibleContacts, newlyFiltered };
};

export const uploadCsv = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "CSV file is required" });
  }

  const { contacts, invalidRows } = await parseContactsFromCsvBuffer(req.file.buffer);

  if (!contacts.length) {
    return res.status(400).json({
      message: "No valid contacts found in CSV",
      invalidCount: invalidRows.length,
    });
  }

  const {
    contacts: contactsWithPlatformStatus,
    onPlatformCount,
    offPlatformCount,
  } = await filterContactsByPlatform(contacts);

  const planCheck = enforcePlanLimit({
    user: req.user,
    contactsCount: onPlatformCount,
  });
  if (!planCheck.allowed) {
    return res.status(403).json({ message: planCheck.message });
  }

  const batch = await BulkBatch.create({
    userId: req.user._id,
    contacts: contactsWithPlatformStatus,
    total: onPlatformCount,
    sourceTotal: contacts.length,
    filteredCount: offPlatformCount,
    invalidCount: invalidRows.length,
    sent: 0,
    failed: 0,
    dispatchStatus: "draft",
  });

  return res.status(201).json({
    batchId: batch._id,
    totalContacts: Number(batch.sourceTotal || contacts.length || 0),
    onPlatformContacts: Number(batch.total || onPlatformCount || 0),
    offPlatformContacts: Number(batch.filteredCount || offPlatformCount || 0),
    invalidContacts: Number(batch.invalidCount || invalidRows.length || 0),
    invalidRows,
    plan: planCheck.plan,
    planLimit: planCheck.limit,
  });
});

export const sendBulk = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const batchId = toSafeString(req.body?.batchId);
  const message = toSafeString(req.body?.message);
  const mediaUrl = toSafeString(req.body?.mediaUrl);
  const mediaUrls = toSafeStringArray(req.body?.mediaUrls);
  const resolvedMediaUrls = mediaUrls.length ? mediaUrls : mediaUrl ? [mediaUrl] : [];

  if (!batchId) {
    return res.status(400).json({ message: "batchId is required" });
  }

  if (!message && !resolvedMediaUrls.length) {
    return res.status(400).json({ message: "Either message or media attachment is required" });
  }

  const batch = await BulkBatch.findOne({ _id: batchId, userId });
  if (!batch) {
    return res.status(404).json({ message: "Bulk batch not found" });
  }

  const {
    nextContacts,
    eligibleContacts: eligiblePendingContacts,
    newlyFiltered,
  } = await revalidatePendingContactsForPlatform(batch.contacts || []);

  if (newlyFiltered > 0) {
    batch.contacts = nextContacts;
    batch.filteredCount = Number(batch.filteredCount || 0) + newlyFiltered;
    batch.total = Math.max(
      0,
      Number(eligiblePendingContacts.length || 0) +
        Number(batch.sent || 0) +
        Number(batch.failed || 0),
    );
    await batch.save();
  }

  const planCheck = enforcePlanLimit({
    user: req.user,
    contactsCount: Number(eligiblePendingContacts.length || 0),
  });
  if (!planCheck.allowed) {
    return res.status(403).json({ message: planCheck.message });
  }

  if (batch.dispatchStatus !== "draft") {
    return res.status(409).json({
      message: "This batch has already been dispatched.",
      dispatchStatus: batch.dispatchStatus,
    });
  }

  const eligibleContacts = eligiblePendingContacts;

  if (!eligibleContacts.length) {
    return res.status(400).json({
      message: "No eligible on-platform contacts found in this batch.",
    });
  }

  const jobs = eligibleContacts.map((contact, index) => ({
    name: "deliver-bulk-message",
    data: {
      batchId: String(batch._id),
      contactId: String(contact._id),
      senderId: String(userId),
      phone: contact.phone,
      text: message,
      mediaUrl: resolvedMediaUrls[0] || "",
      mediaUrls: resolvedMediaUrls,
    },
    opts: {
      jobId: `${String(batch._id)}-${String(contact._id)}`,
      delay: index * BULK_JOB_DELAY_MS,
    },
  }));

  const redisReady = await ensureRedisConnection();
  if (!redisReady) {
    return res.status(503).json({
      message: "Redis is not available. Bulk queue is temporarily offline.",
    });
  }

  if (jobs.length) {
    const queue = getBulkMessageQueue();
    await queue.addBulk(jobs);
  }

  batch.contacts = batch.contacts.map((contact) => {
    const current = contact.toObject();
    if (String(current?.status || "").toLowerCase() !== "pending") {
      return current;
    }
    return {
      ...current,
      status: "queued",
      error: "",
      sentAt: null,
      messageId: null,
    };
  });
  batch.sent = 0;
  batch.failed = 0;
  batch.dispatchStatus = "queued";
  batch.queuedAt = new Date();
  batch.completedAt = null;
  batch.messageTemplate = {
    text: message,
    mediaUrl: resolvedMediaUrls[0] || "",
    mediaUrls: resolvedMediaUrls,
  };
  await batch.save();

  return res.status(202).json({
    message: "Bulk messages queued successfully",
    batchId: batch._id,
    queuedJobs: jobs.length,
    concurrency: Number(process.env.BULK_WORKER_CONCURRENCY || 7),
    retryAttempts: 3,
    delayMsPerJob: BULK_JOB_DELAY_MS,
  });
});

export const getBulkStatus = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const batchId = toSafeString(req.params?.id);
  const includeContacts = String(req.query?.includeContacts || "false") === "true";

  const batch = await BulkBatch.findOne({ _id: batchId, userId }).lean();
  if (!batch) {
    return res.status(404).json({ message: "Bulk batch not found" });
  }

  const pending = Math.max(0, Number(batch.total || 0) - Number(batch.sent || 0) - Number(batch.failed || 0));

  return res.status(200).json({
    batchId: batch._id,
    total: batch.total,
    sourceTotal: Number(batch.sourceTotal || batch.total || 0),
    filteredCount: Number(batch.filteredCount || 0),
    invalidCount: Number(batch.invalidCount || 0),
    sent: batch.sent,
    failed: batch.failed,
    pending,
    dispatchStatus: batch.dispatchStatus,
    createdAt: batch.createdAt,
    queuedAt: batch.queuedAt,
    completedAt: batch.completedAt,
    ...(includeContacts
      ? {
          contacts: (batch.contacts || []).map((contact) => ({
            id: contact._id,
            phone: contact.phone,
            name: contact.name,
            status: contact.status,
            error: contact.error,
            sentAt: contact.sentAt,
          })),
        }
      : {}),
  });
});

export const exportBulkReport = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const batchId = toSafeString(req.params?.id);

  const batch = await BulkBatch.findOne({ _id: batchId, userId }).lean();
  if (!batch) {
    return res.status(404).json({ message: "Bulk batch not found" });
  }

  const rows = [["phone", "name", "status", "error", "sentAt"]];
  (batch.contacts || []).forEach((contact) => {
    rows.push([
      String(contact.phone || ""),
      String(contact.name || ""),
      String(contact.status || ""),
      String(contact.error || ""),
      contact.sentAt ? new Date(contact.sentAt).toISOString() : "",
    ]);
  });

  const escapeCell = (value) => {
    const text = String(value ?? "");
    if (/[,"\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\n");
  const filename = `bulk-report-${String(batch._id)}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
  return res.status(200).send(csv);
});

export const getBulkPlanInfo = asyncHandler(async (req, res) => {
  const { plan, limit } = getUserPlanLimit(req.user);
  return res.status(200).json({ plan, limit });
});
