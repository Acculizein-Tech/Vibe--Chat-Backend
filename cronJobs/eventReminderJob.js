import cron from "node-cron";
import mongoose from "mongoose";
import EventReminder from "../models/EventReminder.js";
import User from "../models/user.js";
import Notification from "../models/Notification.js";
import { sendPushNotification } from "../utils/pushService.js";

const toSafe = (value) => String(value || "").trim();

const parseDateOnly = (raw) => {
  const text = toSafe(raw);
  const parts = text.split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
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

const parseTimeToMinutes = (raw) => {
  const text = toSafe(raw).toUpperCase();
  const match = text.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3] || "";
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  if (period) {
    if (hour < 1 || hour > 12) return null;
    if (period === "AM") hour = hour === 12 ? 0 : hour;
    if (period === "PM") hour = hour === 12 ? 12 : hour + 12;
  }
  return hour * 60 + minute;
};

const getEventStartAtMs = (event) => {
  const date = parseDateOnly(event.date);
  const timeMinutes = parseTimeToMinutes(event.startTime || "");
  if (!date || timeMinutes === null) return null;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Math.floor(timeMinutes / 60),
    timeMinutes % 60,
    0,
    0,
  ).getTime();
};

const getEventEndAtMs = (event) => {
  const date = parseDateOnly(event.date);
  const timeMinutes = parseTimeToMinutes(event.endTime || "");
  if (!date || timeMinutes === null) return null;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Math.floor(timeMinutes / 60),
    timeMinutes % 60,
    0,
    0,
  ).getTime();
};

const getEventReminderAtMs = (event) => {
  const startAt = getEventStartAtMs(event);
  if (startAt === null) return null;
  const reminderValue = Number(event.reminderValue || 0);
  if (!Number.isFinite(reminderValue) || reminderValue < 0) return null;
  const offsetMinutes = event.reminderUnit === "hours" ? reminderValue * 60 : reminderValue;
  return startAt - offsetMinutes * 60 * 1000;
};

const getHumanEventTitle = (event) => {
  const name = toSafe(event.name) || "Upcoming event";
  const date = toSafe(event.date);
  const time = toSafe(event.startTime) || toSafe(event.endTime) || "scheduled time";
  return `${name} • ${date} @ ${time}`;
};

export const startEventReminderJob = (io) => {
  const enabled = String(process.env.ENABLE_EVENT_REMINDER_JOB || "true").toLowerCase() !== "false";
  if (!enabled) {
    console.log("Event reminder cron job is disabled by environment settings.");
    return;
  }

  cron.schedule("* * * * *", async () => {
    const now = new Date();
    const nowMs = now.getTime();

    try {
      if (mongoose.connection.readyState !== 1) {
        return;
      }

      console.log("⏰ Event reminder cron running at", now.toISOString());

      const rows = await EventReminder.find({
        dismissedAt: null,
        $or: [
          { reminderNotifiedAt: null },
          { startNotifiedAt: null },
          { endNotifiedAt: null },
        ],
      }).lean();

      if (!rows.length) {
        return;
      }

      for (const event of rows) {
        const user = await User.findById(event.userId).lean();
        if (!user) continue;

        const startAt = getEventStartAtMs(event);
        const endAt = getEventEndAtMs(event);
        if (startAt === null || endAt === null) continue;

        const reminderAt = getEventReminderAtMs(event);
        const eventTitle = getHumanEventTitle(event);
        const updates = {};

        if (
          event.reminderNotifiedAt === null &&
          reminderAt !== null &&
          reminderAt <= nowMs &&
          nowMs < endAt
        ) {
          const title = "Event Reminder";
          const body = `Reminder for ${eventTitle}`;
          const notification = await Notification.create({
            recipient: event.userId,
            type: "EVENT_REMINDER",
            title,
            message: body,
            data: { eventId: event._id },
          });

          if (io) {
            try {
              console.log(`[EventReminderJob] Emitting events:reminder -> user:${String(event.userId)}`, { eventId: String(event._id), title, message: body });
            } catch (_e) {}
            io.to(`user:${String(event.userId)}`).emit("newNotification", notification);
            io.to(`user:${String(event.userId)}`).emit("events:reminder", {
              event,
              eventId: event._id,
              title,
              message: body,
            });
          }

          if (user.pushToken) {
            await sendPushNotification({
              pushToken: user.pushToken,
              title,
              body,
              data: { type: "EVENT_REMINDER", eventId: String(event._id) },
              subtitle: event.date,
            });
          }

          updates.reminderNotifiedAt = new Date();
        }

        if (
          event.startNotifiedAt === null &&
          nowMs >= startAt &&
          nowMs < endAt
        ) {
          const title = "Event Started";
          const body = `Your event has started: ${eventTitle}`;
          const notification = await Notification.create({
            recipient: event.userId,
            type: "EVENT_REMINDER",
            title,
            message: body,
            data: { eventId: event._id },
          });

          if (io) {
            try {
              console.log(`[EventReminderJob] Emitting events:started -> user:${String(event.userId)}`, { eventId: String(event._id), title, message: body });
            } catch (_e) {}
            io.to(`user:${String(event.userId)}`).emit("newNotification", notification);
            io.to(`user:${String(event.userId)}`).emit("events:started", {
              event,
              eventId: event._id,
              title,
              message: body,
            });
          }

          if (user.pushToken) {
            await sendPushNotification({
              pushToken: user.pushToken,
              title,
              body,
              data: { type: "EVENT_STARTED", eventId: String(event._id) },
              subtitle: event.date,
            });
          }

          updates.startNotifiedAt = new Date();
        }

        if (event.endNotifiedAt === null && nowMs >= endAt) {
          const title = "Event Ended";
          const body = `Your event has ended: ${eventTitle}`;
          const notification = await Notification.create({
            recipient: event.userId,
            type: "EVENT_REMINDER",
            title,
            message: body,
            data: { eventId: event._id },
          });

          if (io) {
            try {
              console.log(`[EventReminderJob] Emitting events:ended -> user:${String(event.userId)}`, { eventId: String(event._id), title, message: body });
            } catch (_e) {}
            io.to(`user:${String(event.userId)}`).emit("newNotification", notification);
            io.to(`user:${String(event.userId)}`).emit("events:ended", {
              event,
              eventId: event._id,
              title,
              message: body,
            });
          }

          if (user.pushToken) {
            await sendPushNotification({
              pushToken: user.pushToken,
              title,
              body,
              data: { type: "EVENT_ENDED", eventId: String(event._id) },
              subtitle: event.date,
            });
          }

          updates.endNotifiedAt = new Date();
        }

        if (Object.keys(updates).length) {
          await EventReminder.updateOne({ _id: event._id }, { $set: updates });
        }
      }
    } catch (error) {
      const message = String(error?.message || error || "");
      if (message.includes("ENOTFOUND") || message.includes("MongoServerSelectionError")) {
        return;
      }
      console.error("Event reminder cron failed:", error);
    }
  });
};
