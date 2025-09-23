import mongoose from "mongoose";

const redeemRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "processed"],
      default: "pending",
    },
    requestedAt: {
      type: Date,
      default: Date.now, // ✅ auto track kab request ki gayi
    },
    processedAt: {
      type: Date, // ✅ superadmin approve karega to set hoga
    },
    remarks: {
      type: String, // optional: superadmin add karega note
    },
  },
  { timestamps: true }
);

export default mongoose.model("RedeemRequest", redeemRequestSchema);
