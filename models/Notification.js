// models/Notification.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null // user-specific
    },

    role: {
      type: String,
      enum: ["superadmin", "admin", "sales" , "customer"],
      default: null // role-based
    },

    scope: {
      type: String,
      enum: ["USER", "ROLE", "GLOBAL"],
      default: "USER"
    },

    type: {
      type: String,
      enum: [
        "NEW_MESSAGE",
        "REVIEW_RECEIVED",
        "LEAD_GENERATED",
        "BUSINESS_CREATED",
        "CUSTOMER_ENQUIRY",
        "ADMIN_ALERT",
        "EVENT_REMINDER",
        "EMI_REMINDER"
      ],
      required: true
    },

    title: { type: String, required: true },
    message: { type: String, required: true },

    data: {
      conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation"
      },
      senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "EventReminder"
      },
      emiId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "EmiPlan"
      },
      dueDate: {
        type: String
      },
      reminderDate: {
        type: String
      },
      cycleStartDate: {
        type: String
      },
      reminderStage: {
        type: String
      },
      daysRemaining: {
        type: Number
      }
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  { timestamps: true }
);

notificationSchema.index({
  recipient: 1,
  "data.conversationId": 1,
  type: 1
});

export default mongoose.model("Notification", notificationSchema);
