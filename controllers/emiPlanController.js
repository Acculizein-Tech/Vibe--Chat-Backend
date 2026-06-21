import EmiPlan from "../models/EmiPlan.js";
import Notification from "../models/Notification.js";

const toSafe = (v) => String(v || "").trim();
const toNum = (v, fallback = 0) => {
  const n = Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
};
const parseDateOnly = (raw) => {
  const text = toSafe(raw);
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(y, mo - 1, d, 0, 0, 0, 0);
};
const formatDateYYYYMMDD = (dateObj) =>
  `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(
    dateObj.getDate(),
  ).padStart(2, "0")}`;
const addInterval = (baseDate, frequency, customDays, steps = 0) => {
  if (!(baseDate instanceof Date) || Number.isNaN(baseDate.getTime())) return null;
  const next = new Date(baseDate.getTime());
  const stepCount = Math.max(0, Math.floor(Number(steps) || 0));
  if (frequency === "weekly") {
    next.setDate(next.getDate() + stepCount * 7);
  } else if (frequency === "custom") {
    const days = Math.max(1, Math.floor(Number(customDays) || 30));
    next.setDate(next.getDate() + stepCount * days);
  } else {
    next.setMonth(next.getMonth() + stepCount);
  }
  return next;
};
const subtractDays = (baseDate, days) => {
  if (!(baseDate instanceof Date) || Number.isNaN(baseDate.getTime())) return null;
  const next = new Date(baseDate.getTime());
  next.setDate(next.getDate() - Math.max(0, Math.floor(Number(days) || 0)));
  return next;
};
const COMPLETED_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;
const getDayStartMs = (dateObj) =>
  new Date(
    dateObj.getFullYear(),
    dateObj.getMonth(),
    dateObj.getDate(),
    0,
    0,
    0,
    0,
  ).getTime();
const computeEmiSnapshot = (doc) => {
  const totalLoanAmount = Math.max(0, toNum(doc?.totalLoanAmount, 0));
  const downPayment = Math.min(
    Math.max(0, toNum(doc?.downPayment, 0)),
    totalLoanAmount,
  );
  const emiAmount = Math.max(0, toNum(doc?.emiAmount, 0));
  const paidEmiCount = Math.max(0, Math.floor(toNum(doc?.paidEmiCount, 0)));
  const startDate = doc?.startDate ? new Date(doc.startDate) : null;
  const frequency = String(doc?.emiFrequency || "monthly");
  const customFrequencyDays = Math.max(1, Math.floor(toNum(doc?.customFrequencyDays, 30)));
  const manualDueDate = doc?.dueDate ? parseDateOnly(doc.dueDate) : null;
  const principalRemaining = Math.max(totalLoanAmount - downPayment, 0);
  const paidAmount = Math.min(principalRemaining, paidEmiCount * emiAmount);
  const remainingAmount = Math.max(principalRemaining - paidAmount, 0);
  const pendingEmiCount =
    remainingAmount <= 0
      ? 0
      : emiAmount > 0
        ? Math.ceil(remainingAmount / emiAmount)
        : 0;
  const cycleStartDate = addInterval(startDate, frequency, customFrequencyDays, paidEmiCount);
  const nextDueDate = manualDueDate
    ? addInterval(manualDueDate, frequency, customFrequencyDays, paidEmiCount)
    : addInterval(startDate, frequency, customFrequencyDays, paidEmiCount + 1);
  const nowMs = Date.now();
  const dueDayStartMs = nextDueDate ? getDayStartMs(nextDueDate) : null;
  const todayStartMs = getDayStartMs(new Date(nowMs));
  const daysRemaining =
    dueDayStartMs === null ? null : Math.max(0, Math.ceil((dueDayStartMs - todayStartMs) / (24 * 60 * 60 * 1000)));
  const overdueDays =
    dueDayStartMs !== null && todayStartMs > dueDayStartMs
      ? Math.ceil((todayStartMs - dueDayStartMs) / (24 * 60 * 60 * 1000))
      : 0;
  const status =
    remainingAmount <= 0
      ? "completed"
      : dueDayStartMs === null
        ? "active"
        : todayStartMs < dueDayStartMs
          ? "upcoming"
          : todayStartMs === dueDayStartMs
            ? "due_today"
            : "overdue";
  const displayStatus =
    status === "completed"
      ? "Completed"
      : status === "due_today"
        ? "Due Today"
        : status === "overdue"
          ? `Overdue by ${overdueDays} day${overdueDays === 1 ? "" : "s"}`
          : `Upcoming - ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining`;
  const hasLoanData =
    totalLoanAmount > 0 || downPayment > 0 || emiAmount > 0 || paidEmiCount > 0 || Boolean(startDate);
  const reminderDate = nextDueDate
    ? subtractDays(nextDueDate, 2) || nextDueDate
    : null;
  return {
    ...doc,
    borrowerName: toSafe(doc?.borrowerName),
    emiType: toSafe(doc?.emiType) || "Credit Card EMI",
    customEmiType: toSafe(doc?.customEmiType),
    totalLoanAmount,
    downPayment,
    emiAmount,
    paidEmiCount,
    startDate: startDate ? formatDateYYYYMMDD(startDate) : null,
    emiFrequency: ["weekly", "monthly", "custom"].includes(frequency) ? frequency : "monthly",
    customFrequencyDays,
    dueDate: nextDueDate ? formatDateYYYYMMDD(nextDueDate) : null,
    remainingAmount,
    pendingEmiCount,
    cycleStartDate: cycleStartDate ? formatDateYYYYMMDD(cycleStartDate) : null,
    nextDueDate: nextDueDate ? formatDateYYYYMMDD(nextDueDate) : null,
    reminderDate: reminderDate ? formatDateYYYYMMDD(reminderDate) : null,
    daysRemaining,
    overdueDays,
    displayStatus,
    cardVisibility: hasLoanData && remainingAmount > 0,
    isCompleted:
      (hasLoanData && remainingAmount <= 0) ||
      String(doc?.status || "").toLowerCase() === "completed",
    status,
    paymentHistory: Array.isArray(doc?.paymentHistory) ? doc.paymentHistory : [],
  };
};
const emitEmiChange = (req, userId, action, emiDoc) => {
  try {
    const io = req?.app?.get?.("io");
    if (!io || !userId) return;
    io.to(`user:${String(userId)}`).emit("emi:changed", {
      action: String(action || "updated"),
      emi: emiDoc || null,
      at: new Date().toISOString(),
    });
  } catch (_err) {
    // no-op
  }
};

const normalizePayload = (payload = {}) => {
  const totalLoanAmount = Math.max(0, toNum(payload.totalLoanAmount, 0));
  const downPayment = Math.min(Math.max(0, toNum(payload.downPayment, 0)), totalLoanAmount);
  const emiAmount = Math.max(0, toNum(payload.emiAmount, 0));
  const paidEmiCount = Math.max(0, Math.floor(toNum(payload.paidEmiCount, 0)));
  const startDate = parseDateOnly(payload.startDate);
  if (!startDate) return null;
  const frequency = String(payload.emiFrequency || "monthly").toLowerCase();
  const emiFrequency = ["weekly", "monthly", "custom"].includes(frequency)
    ? frequency
    : "monthly";
  const customFrequencyDays = Math.max(1, Math.floor(toNum(payload.customFrequencyDays, 30)));
  const dueDate = parseDateOnly(payload.dueDate);
  const reminderDate = parseDateOnly(payload.reminderDate);
  return {
    borrowerName: toSafe(payload.borrowerName),
    emiType: toSafe(payload.emiType) || "Credit Card EMI",
    customEmiType: toSafe(payload.customEmiType),
    totalLoanAmount,
    downPayment,
    emiAmount,
    paidEmiCount,
    startDate,
    emiFrequency,
    customFrequencyDays,
    dueDate,
    reminderDate,
    paymentHistory: Array.isArray(payload.paymentHistory) ? payload.paymentHistory : [],
    reminderLastSentAt: payload.reminderLastSentAt ? new Date(payload.reminderLastSentAt) : null,
  };
};

export const createEmiPlan = async (req, res) => {
  try {
    const userId = String(req.user?._id || req.user?.id || "").trim();
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const normalized = normalizePayload(req.body || {});
    if (!normalized) {
      return res.status(400).json({ message: "startDate and numeric EMI fields are required" });
    }
    if (normalized.emiType === "Other" && !toSafe(req.body?.customEmiType)) {
      return res.status(400).json({ message: "customEmiType is required for Other EMI type" });
    }
    if (!normalized.totalLoanAmount || !normalized.emiAmount) {
      return res.status(400).json({ message: "totalLoanAmount and emiAmount must be greater than 0" });
    }
    if (
      normalized.dueDate &&
      normalized.startDate &&
      normalized.dueDate.getTime() < normalized.startDate.getTime()
    ) {
      return res.status(400).json({ message: "Due date must be on or after the start date" });
    }

    const doc = await EmiPlan.create({
      userId,
      ...normalized,
      status: "active",
      completedAt: null,
      lastPaymentAt: null,
    });
    const computed = computeEmiSnapshot(doc.toObject());
    emitEmiChange(req, userId, "created", computed);
    return res.status(201).json({ emiPlan: computed });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const listEmiPlans = async (req, res) => {
  try {
    const userId = String(req.user?._id || req.user?.id || "").trim();
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const includeAll = String(req.query?.includeAll || "").trim() === "1";
    const rows = await EmiPlan.find({ userId }).sort({ updatedAt: -1, createdAt: -1 }).lean();
    const computed = rows
      .map((row) => computeEmiSnapshot(row))
      .filter((row) => {
        if (row.status !== "completed") return true;
        if (!includeAll) return false;
        const completedAtMs = row.completedAt ? new Date(row.completedAt).getTime() : 0;
        if (!Number.isFinite(completedAtMs) || completedAtMs <= 0) return true;
        return Date.now() - completedAtMs <= COMPLETED_RETENTION_MS;
      });
    return res.status(200).json({ emiPlans: computed });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const updateEmiPlan = async (req, res) => {
  try {
    const userId = String(req.user?._id || req.user?.id || "").trim();
    const id = toSafe(req.params?.id);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!id) return res.status(400).json({ message: "id is required" });

    const normalized = normalizePayload(req.body || {});
    if (!normalized) {
      return res.status(400).json({ message: "startDate and numeric EMI fields are required" });
    }
    if (normalized.emiType === "Other" && !toSafe(req.body?.customEmiType)) {
      return res.status(400).json({ message: "customEmiType is required for Other EMI type" });
    }
    if (
      normalized.dueDate &&
      normalized.startDate &&
      normalized.dueDate.getTime() < normalized.startDate.getTime()
    ) {
      return res.status(400).json({ message: "Due date must be on or after the start date" });
    }

    const updated = await EmiPlan.findOneAndUpdate(
      { _id: id, userId },
      {
      $set: {
          ...normalized,
          status: "active",
          completedAt: null,
          reminderLastSentAt: null,
        },
      },
      { new: true },
    ).lean();
    if (!updated) return res.status(404).json({ message: "EMI plan not found" });
    const computed = computeEmiSnapshot(updated);
    emitEmiChange(req, userId, "updated", computed);
    return res.status(200).json({ emiPlan: computed });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const recordEmiPayment = async (req, res) => {
  try {
    const userId = String(req.user?._id || req.user?.id || "").trim();
    const id = toSafe(req.params?.id);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!id) return res.status(400).json({ message: "id is required" });

    const row = await EmiPlan.findOne({ _id: id, userId }).lean();
    if (!row) return res.status(404).json({ message: "EMI plan not found" });
    const current = computeEmiSnapshot(row);
    if (current.status === "completed") {
      return res.status(200).json({ emiPlan: current });
    }

    const paymentAmount = Math.max(
      0,
      toNum(req.body?.amount, current.emiAmount || 0),
    );
    const newPaidCount = current.paidEmiCount + 1;
    const paymentHistory = Array.isArray(row.paymentHistory) ? [...row.paymentHistory] : [];
    paymentHistory.unshift({
      amount: paymentAmount,
      paidAt: new Date(),
      note: toSafe(req.body?.note),
    });

    const nextUpdate = {
      paidEmiCount: newPaidCount,
      lastPaymentAt: new Date(),
      paymentHistory,
      reminderLastSentAt: null,
    };
    const afterPreview = computeEmiSnapshot({ ...row, ...nextUpdate });
    if (afterPreview.remainingAmount <= 0) {
      nextUpdate.status = "completed";
      nextUpdate.completedAt = new Date();
    }

    const updated = await EmiPlan.findOneAndUpdate(
      { _id: id, userId },
      { $set: nextUpdate },
      { new: true },
    ).lean();
    if (!updated) return res.status(404).json({ message: "EMI plan not found" });
    await Notification.updateMany(
      {
        recipient: userId,
        type: "EMI_REMINDER",
        "data.emiId": updated._id,
        isRead: false,
      },
      { $set: { isRead: true } },
    );
    const computed = computeEmiSnapshot(updated);
    emitEmiChange(req, userId, "payment", computed);
    return res.status(200).json({ emiPlan: computed });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const deleteEmiPlan = async (req, res) => {
  try {
    const userId = String(req.user?._id || req.user?.id || "").trim();
    const id = toSafe(req.params?.id);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!id) return res.status(400).json({ message: "id is required" });

    const deleted = await EmiPlan.findOneAndDelete({ _id: id, userId }).lean();
    if (!deleted) return res.status(404).json({ message: "EMI plan not found" });
    emitEmiChange(req, userId, "deleted", { _id: id });
    return res.status(200).json({ success: true, id });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
