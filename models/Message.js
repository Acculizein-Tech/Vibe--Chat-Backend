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
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // for 1-to-1 chat
    },
    // for group messages, we can later add groupId
    text: {
      type: String,
      trim: true,
      default: "",
    },
    media: [
      {
        url: String, // image, video, audio, document
        type: { type: String, enum: ["image", "video", "audio", "file"] },
      },
    ],
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    forwarded: { type: Boolean, default: false },
forwardedFrom: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Index for faster retrieval (e.g., conversation chat history)
messageSchema.index({ conversationId: 1, createdAt: 1 });

// Prevent OverwriteModelError
const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);

export default Message;
