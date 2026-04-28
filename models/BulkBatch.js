import mongoose from "mongoose";

const bulkContactSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "queued", "sent", "failed", "filtered"],
      default: "pending",
    },
    error: {
      type: String,
      default: "",
      trim: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
  },
  { _id: true },
);

const bulkBatchSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    contacts: {
      type: [bulkContactSchema],
      default: [],
    },
    total: {
      type: Number,
      default: 0,
      min: 0,
    },
    sourceTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    filteredCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    invalidCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    sent: {
      type: Number,
      default: 0,
      min: 0,
    },
    failed: {
      type: Number,
      default: 0,
      min: 0,
    },
    dispatchStatus: {
      type: String,
      enum: ["draft", "queued", "processing", "completed"],
      default: "draft",
      index: true,
    },
    messageTemplate: {
      text: {
        type: String,
        default: "",
      },
      mediaUrl: {
        type: String,
        default: "",
      },
      mediaUrls: {
        type: [String],
        default: [],
      },
    },
    queuedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

bulkBatchSchema.index({ userId: 1, createdAt: -1 });

const BulkBatch =
  mongoose.models.BulkBatch || mongoose.model("BulkBatch", bulkBatchSchema);

export default BulkBatch;
