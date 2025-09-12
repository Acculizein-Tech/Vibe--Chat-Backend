import mongoose from "mongoose";
import { type } from "os";

const advertisementSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // track which user created the ad
    },
    adType: { type: String, enum: ["customer", "admin", "superadmin"]},

    title:{type :String},
    image: {
      type: String, // S3 image URL
      
    },
    video: {
      type: String, // S3 video URL
    },
    redirectUrl: {
      type: String, // Landing page when clicked
      required: true,
    },

    // User suggestion (optional)
    suggestedPages: {
      type: [String], // user requested pages
      default: [],
    },

    // SuperAdmin final selection ✅
     pagesToDisplay: {
      type: Map,
      of: Boolean,
      default: {},
    },

    //  /* ---------- New targeting fields ---------- */
    // cities: {
    //   type: String, // ["Delhi", "Mumbai"]
    //   default: [],
    // },
    category:{type:String},
     services: {
      type: Map,
      of: Boolean,
      default: {},
    },
    city:{type:String},
    // categories: {
    //   type: [String], // ["Health", "Education"]
    //   default: [],
    // },
    // subCategories: {
    //   type: [String], // ["Hospital", "Gym"]
    //   default: [],
    // },

    startDate: {
      type: Date,
     
    },
    endDate: {
      type: Date,
     
    },

    adminApproved: {
      type: Boolean,
      default: false, // 🔑 superadmin toggles this
    },

    status: {
      type: String,
      enum: ["pending", "active", "paused", "expired", "rejected"],
      default: "pending",
    },

    /* ---------- Billing / pricing fields ---------- */
    // Which billing model this ad uses:
    billingModel: {
      type: String,
      enum: ["CPD", "CPM"], // Cost Per Day, Cost Per Mille (per 1,000 impressions)
      default: "CPD",
    },

    // Interpreted based on billingModel:
    // - CPD: bidAmount = INR per active day (e.g. 5 => ₹5 per day)
    // - CPM: bidAmount = INR per 1000 impressions (e.g. 50 => ₹50 per 1000 impressions)
    bidAmount: {
      type: Number,
      default: 5,
    },

    // Optional caps
    dailyBudget: {
      type: Number, // optional cap per day (₹)
      default: 0,
    },
    totalBudget: {
      type: Number, // optional cap for the whole ad (₹). 0 means no cap.
      default: 0,
    },

    /* ---------- runtime metrics & billing state ---------- */
    impressions: {
      type: Number,
      default: 0,
    },
    clicks: {
      type: Number,
      default: 0,
    },
    spend: {
      type: Number, // total charged so far (₹)
      default: 0,
    },
    lastBilledAt: {
      type: Date,
    },

    // for human readable reason when paused
    pausedReason: {
      type: String,
    },
    /* ---------- Consent ---------- */
    consentAccepted: {
      type: Boolean,
       required: [true, "User must accept the consent to create an advertisement."],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Advertisement", advertisementSchema);
