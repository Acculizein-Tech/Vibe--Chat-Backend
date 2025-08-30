import mongoose from "mongoose";

const redeemSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  amount: {
    type: Number,
    min: 1,
  },
  mode: {
    type: String,
    enum: ["UPI", "BANK_TRANSFER", "PAYTM_WALLET"],
    
  },
  upiId: { type: String },   // agar UPI select kiya
  bankAccount: {
    accountNumber: { type: String },
    ifsc: { type: String },
    bankName: { type: String },
  },
  status: {
    type: String,
    enum: ["PENDING", "PROCESSING", "SUCCESS", "FAILED"],
    default: "PENDING",
  },
}, { timestamps: true });

export default mongoose.model("Redeem", redeemSchema);
