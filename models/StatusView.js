import mongoose from "mongoose";

const statusViewSchema = new mongoose.Schema(
  {
    status: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Status",
      required: true,
      index: true,
    },
    viewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

statusViewSchema.index({ status: 1, viewer: 1 }, { unique: true });

const StatusView =
  mongoose.models.StatusView || mongoose.model("StatusView", statusViewSchema);
export default StatusView;

