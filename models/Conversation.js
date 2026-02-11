import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
    receiverPhone: { type: String }, // when user not yet registered
    status: {
      type: String,
      enum: ["active", "pending", "closed"],
      default: "active",
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    isGroup: { type: Boolean, default: false },
    groupName: String,
    groupAvatar: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userImages: {
      type: [String],
      default: []
    },
  },

  { timestamps: true }
);

// Optional: quick lookup optimization
conversationSchema.index({ participants: 1 });
conversationSchema.index({ receiverPhone: 1 });

const Conversation =
  mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema);

export default Conversation;
