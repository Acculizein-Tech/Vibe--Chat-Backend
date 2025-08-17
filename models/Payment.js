import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
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
    totalAmount: { type: Number },

    tax: {
      cgst: { type: Number, default: 0 },
      sgst: { type: Number, default: 0 },
      igst: { type: Number, default: 0 },
    },
    invoiceNumber: { type: String }, // Unique invoice number for tracking
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
      category: String, // e.g., Individual, Business
      address: String,
      userGst: String,
      // ✅ Structured Address
      location: {
        address: { type: String },
        addressLink: { type: String },
        city: { type: String },
        state: { type: String },
        country: { type: String },
        pincode: { type: String },
      },

      // ✅ Newly Added Fields
      planName: { type: String },
      planPrice: { type: Number }, // e.g., Basic, Premium
      currency: { type: String, default: "INR" }, // Support for multi-currency
      // invoiceUrl: { type: String },               // Link to the generated invoice
      // paymentMode: { type: String },
    },
    companyData: {
      companyName: String,
      companyAddress: String,
      companyPhone: String,
      companyEmail: String,
      gstin: String, // GSTIN for tax purposes
    },

    // UPI, Card, Netbanking, etc.
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

export default mongoose.model("Payment", paymentSchema);
