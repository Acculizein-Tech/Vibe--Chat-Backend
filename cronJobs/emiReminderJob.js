import cron from "node-cron";
import mongoose from "mongoose";
import EmiPlan from "../models/EmiPlan.js";
import User from "../models/user.js";
import Notification from "../models/Notification.js";
import { sendPushNotification } from "../utils/pushService.js";

const HOUR_MS = 60 * 60 * 1000;
const THREE_HOURS_MS = 3 * HOUR_MS;
const TWO_DAYS_MS = 2 * 24 * HOUR_MS;
const COMPLETED_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

const toSafe = (value) => String(value || "").trim();

const parseDateOnly = (raw) => {
  const text = toSafe(raw);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
};

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

const formatYYYYMMDD = (dateObj) =>
  `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(
    dateObj.getDate(),
  ).padStart(2, "0")}`;

const buildEmiReminderMessage = ({ stage, borrowerName, dueDate, daysRemaining }) => {
  const title = borrowerName ? `${borrowerName} EMI` : "EMI Reminder";
  if (stage === "started") {
    return {
      title: "EMI cycle started",
      message: `${title} cycle started today. The next due date is ${dueDate}.`,
    };
  }
  if (stage === "upcoming") {
    return {
      title: "EMI reminder",
      message:
        daysRemaining === 1
          ? `${title} is due tomorrow. Please keep the payment ready.`
          : `${title} is due in ${daysRemaining} days. Please keep the payment ready.`,
    };
  }
  if (stage === "due_today") {
    return {
      title: "EMI due today",
      message: `${title} is due today. Please pay it as soon as possible.`,
    };
  }
  return {
    title: "EMI overdue",
    message: `${title} is overdue. Please pay immediately to avoid issues.`,
  };
};

const computeReminderPlan = (plan) => {
  const startDate = parseDateOnly(plan?.startDate || "");
  if (!startDate) return null;
  const frequency = String(plan?.emiFrequency || "monthly");
  const customFrequencyDays = Math.max(
    1,
    Math.floor(Number(plan?.customFrequencyDays || 30)),
  );
  const paidEmiCount = Math.max(0, Math.floor(Number(plan?.paidEmiCount || 0)));
  const cycleStartAt = addInterval(startDate, frequency, customFrequencyDays, paidEmiCount);
  const manualDueDate = parseDateOnly(plan?.dueDate || "");
  const dueAt = manualDueDate
    ? addInterval(manualDueDate, frequency, customFrequencyDays, paidEmiCount)
    : addInterval(startDate, frequency, customFrequencyDays, paidEmiCount + 1);
  if (!cycleStartAt || !dueAt) return null;
  const reminderAt = new Date(dueAt.getTime() - TWO_DAYS_MS);
  return {
    cycleStartAt,
    dueAt,
    reminderAt,
  };
};

export const startEmiReminderJob = (io) => {
  const enabled =
    String(process.env.ENABLE_EMI_REMINDER_JOB || "true").toLowerCase() !== "false";
  if (!enabled) {
    console.log("EMI reminder cron job is disabled by environment settings.");
    return;
  }

  cron.schedule("*/15 * * * *", async () => {
    const now = new Date();
    const nowMs = now.getTime();

    try {
      if (mongoose.connection.readyState !== 1) return;

      const plans = await EmiPlan.find({
        status: { $ne: "completed" },
      }).lean();

      if (!plans.length) return;

      for (const plan of plans) {
        const reminderWindow = computeReminderPlan(plan);
        if (!reminderWindow) continue;

        const { cycleStartAt, dueAt, reminderAt } = reminderWindow;
        const cycleStartMs = cycleStartAt.getTime();
        const dueDayStartMs = getDayStartMs(dueAt);
        if (nowMs < cycleStartMs) continue;

        const lastSentAtMs = plan.reminderLastSentAt
          ? new Date(plan.reminderLastSentAt).getTime()
          : 0;
        if (lastSentAtMs && nowMs - lastSentAtMs < THREE_HOURS_MS) {
          continue;
        }

        const user = await User.findById(plan.userId).select("pushToken fullName").lean();
        if (!user) continue;

        const todayStartMs = getDayStartMs(now);
        const dueDateText = formatYYYYMMDD(dueAt);
        const reminderDateText = formatYYYYMMDD(reminderAt);
        const daysRemaining =
          todayStartMs < dueDayStartMs
            ? Math.ceil((dueDayStartMs - todayStartMs) / (24 * HOUR_MS))
            : 0;
        const stage =
          todayStartMs < dueDayStartMs
            ? todayStartMs === cycleStartMs
              ? "started"
              : "upcoming"
            : todayStartMs === dueDayStartMs
              ? "due_today"
              : "overdue";
        const humanName = toSafe(plan.borrowerName) || "Personal EMI";
        const copy = buildEmiReminderMessage({
          stage,
          borrowerName: humanName,
          dueDate: dueDateText,
          daysRemaining,
        });

        const notification = await Notification.create({
          recipient: user._id,
          scope: "USER",
          type: "EMI_REMINDER",
          title: copy.title,
          message: copy.message,
          data: {
            emiId: plan._id,
            dueDate: dueDateText,
            reminderDate: reminderDateText,
            cycleStartDate: formatYYYYMMDD(cycleStartAt),
            reminderStage: stage,
            daysRemaining,
          },
          isRead: false,
        });

        if (io) {
          io.to(`user:${String(user._id)}`).emit("newNotification", notification);
          io.to(`user:${String(user._id)}`).emit("emi:reminder", {
            plan,
            notification,
            stage,
          });
        }

        if (user.pushToken) {
          await sendPushNotification({
            pushToken: user.pushToken,
            title: copy.title,
            body: copy.message,
            data: {
              type: "EMI_REMINDER",
              emiId: String(plan._id),
              dueDate: dueDateText,
              reminderDate: reminderDateText,
              cycleStartDate: formatYYYYMMDD(cycleStartAt),
              reminderStage: stage,
            },
            subtitle: humanName,
          });
        }

        await EmiPlan.updateOne(
          { _id: plan._id },
          {
            $set: {
              reminderLastSentAt: now,
            },
          },
        );
      }

      const completionCutoff = new Date(nowMs - COMPLETED_RETENTION_MS);
      const staleCompletedPlans = await EmiPlan.find({
        status: "completed",
        completedAt: { $lte: completionCutoff },
      })
        .select("_id userId")
        .lean();

      if (staleCompletedPlans.length) {
        const staleIds = staleCompletedPlans.map((plan) => plan._id);
        await EmiPlan.deleteMany({ _id: { $in: staleIds } });
        await Notification.deleteMany({
          type: "EMI_REMINDER",
          "data.emiId": { $in: staleIds },
        });
        if (io) {
          const emittedAt = new Date().toISOString();
          staleCompletedPlans.forEach((plan) => {
            io.to(`user:${String(plan.userId)}`).emit("emi:changed", {
              action: "deleted",
              emi: { _id: String(plan._id) },
              at: emittedAt,
            });
          });
        }
      }
    } catch (error) {
      const message = String(error?.message || error || "");
      if (message.includes("ENOTFOUND") || message.includes("MongoServerSelectionError")) {
        return;
      }
      console.error("EMI reminder cron failed:", error);
    }
  });
};
