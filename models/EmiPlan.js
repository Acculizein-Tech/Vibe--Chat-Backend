import mongoose from "mongoose";

const emiPaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, default: 0 },
    paidAt: { type: Date, default: Date.now },
    note: { type: String, default: "" },
  },
  { _id: false },
);

const emiPlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    borrowerName: { type: String, default: "" },
    emiType: { type: String, default: "Credit Card EMI" },
    customEmiType: { type: String, default: "" },
    totalLoanAmount: { type: Number, default: 0 },
    downPayment: { type: Number, default: 0 },
    emiAmount: { type: Number, default: 0 },
    paidEmiCount: { type: Number, default: 0 },
    startDate: { type: Date, required: true, index: true },
    emiFrequency: {
      type: String,
      enum: ["weekly", "monthly", "custom"],
      default: "monthly",
    },
    customFrequencyDays: { type: Number, default: 30 },
    dueDate: { type: Date, default: null },
    reminderDate: { type: Date, default: null },
    reminderLastSentAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
      index: true,
    },
    completedAt: { type: Date, default: null },
    lastPaymentAt: { type: Date, default: null },
    paymentHistory: { type: [emiPaymentSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model("EmiPlan", emiPlanSchema);
