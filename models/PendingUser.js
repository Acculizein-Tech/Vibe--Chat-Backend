import mongoose from "mongoose";

const pendingUserSchema = new mongoose.Schema({
  fullName: String,
  email: { type: String, unique: true },
  phone: String,
  password: String,
  role: String,
  profile: Object,

  otp: String,
  otpExpires: Date,

  referralCode: String,
  referredBy: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

export default mongoose.model("PendingUser", pendingUserSchema);
