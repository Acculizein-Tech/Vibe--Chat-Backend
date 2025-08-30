import mongoose from 'mongoose';

const kycSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
   
     // har user ki ek hi KYC hogi
  },

  // Aadhaar images business model se uthenge, yaha store nahi karenge
  aadhaarFront: {
    type: String, // will be auto-fetched from Business model
    required: false,
  },
  aadhaarBack: {
    type: String,
    required: false,
  },

  // PAN Card (optional)
  panCard: {
    type: String,
    required: false,
  },

  // Bank details (mandatory for payouts)
  bankDetails: {
    accountNumber: { type: String  },
    ifsc: { type: String},
    accountHolderName: { type: String },
  },

  // Admin verification for enabling payouts
  isPaymentified: { 
    type: Boolean, 
    default: false 
  },

  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("KYC", kycSchema);
