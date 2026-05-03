import mongoose from "mongoose";

const statusSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    text: {
      type: String,
      default: "",
      trim: true,
      maxlength: 700,
    },
    textStyle: {
      theme: {
        bg: { type: String, default: "" },
        card: { type: String, default: "" },
        glow: { type: String, default: "" },
        accent: { type: String, default: "" },
      },
      fontSize: { type: Number, default: 0 },
      fontWeight: { type: String, default: "" },
      fontStyle: { type: String, default: "" },
      textAlign: { type: String, default: "" },
      letterSpacing: { type: Number, default: 0 },
      fontFamily: { type: String, default: "" },
      presetKey: { type: String, default: "" },
    },
    media: {
      type: [
        {
          url: { type: String, required: true },
          type: { type: String, enum: ["image", "video"], required: true },
          mimeType: { type: String, default: "" },
          fileName: { type: String, default: "" },
          sizeBytes: { type: Number, default: null },
          thumbnailUrl: { type: String, default: "" },
          caption: { type: String, default: "", trim: true, maxlength: 700 },
        },
      ],
      default: [],
    },
    visibility: {
      type: String,
      enum: ["contacts", "all"],
      default: "contacts",
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

statusSchema.index({ user: 1, createdAt: -1 });
statusSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Status = mongoose.models.Status || mongoose.model("Status", statusSchema);
export default Status;
