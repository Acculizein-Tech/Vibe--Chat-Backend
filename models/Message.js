import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      ref: "User", // 1-to-1 => ObjectId, group => ObjectId[]
    },
    // for group messages, we can later add groupId
    text: {
      type: String,
      trim: true,
      default: "",
    },
    encryptedText: {
      type: String,
      default: "",
    },
    textIv: {
      type: String,
      default: "",
    },
    textAuthTag: {
      type: String,
      default: "",
    },
    textAlg: {
      type: String,
      default: "aes-256-gcm",
    },
    encryptionVersion: {
      type: Number,
      default: 1,
    },
    isEncrypted: {
      type: Boolean,
      default: false,
    },
    media: [
      {
        url: String, // image, video, audio, document
        type: { type: String, enum: ["image", "video", "audio", "file"] },
        thumbnailUrl: { type: String, default: "" },
        fileName: { type: String, default: "" },
        mimeType: { type: String, default: "" },
        sizeBytes: { type: Number, default: null },
        pageCount: { type: Number, default: null },
      },
    ],
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    deliveryInfo: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        deliveredAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    readInfo: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    forwarded: { type: Boolean, default: false },
    forwardedFrom: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // Business/account visibility markers
    senderAccountType: { type: String, default: "" },
  },
  { timestamps: true }
);

// Index for faster retrieval (e.g., conversation chat history)
messageSchema.index({ conversationId: 1, createdAt: 1 });

// Prevent OverwriteModelError
const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);

export default Message;
