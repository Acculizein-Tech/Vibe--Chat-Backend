import mongoose from "mongoose";

const eventReminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: { type: String, required: true },
    name: { type: String, required: true },
    eventType: { type: String, default: "Work" },
    customEventType: { type: String, default: "" },
    description: { type: String, default: "" },
    startTime: { type: String, default: "" },
    endTime: { type: String, required: true },
    endAt: { type: Date, index: true },
    location: { type: String, default: "" },
    reminderNotifiedAt: { type: Date, default: null, index: true },
    startNotifiedAt: { type: Date, default: null, index: true },
    endNotifiedAt: { type: Date, default: null, index: true },
    eventImage: { type: String, default: "" },
    reminderValue: { type: Number, default: 30 },
    reminderUnit: { type: String, enum: ["minutes", "hours"], default: "minutes" },
    dismissedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model("EventReminder", eventReminderSchema);
