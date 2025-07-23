import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",

  },
  orderId: { type: String, required: true },
  paymentId: { type: String, required: true },
  signature: { type: String, required: true },

  amount: { type: Number },
  baseAmount: { type: Number }, // amount before tax

  tax: {
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
  },

  isUP: { type: Boolean },

  status: {
    type: String,
    enum: ["success", "failed", "pending"],
    default: "pending",
  },

  billingDetails: {
    businessName: String,
    ownerName: String,
    email: String,
    phone: Number,
    state: String, // e.g., UP, Delhi

      // ✅ Newly Added Fields
  planName: { type: String }, 
  planPrice: { type: Number },               // e.g., Basic, Premium
  currency: { type: String, default: "INR" }, // Support for multi-currency
  // invoiceUrl: { type: String },               // Link to the generated invoice
  // paymentMode: { type: String },    
   
  },

          // UPI, Card, Netbanking, etc.

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("Payment", paymentSchema);
