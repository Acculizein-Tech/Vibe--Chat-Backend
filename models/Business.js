// models/Business.js
import mongoose from "mongoose";

// const mongoose = require('mongoose');
function arrayLimit(val) {
  return val.length <= 10;
}

const businessSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    ownerName: String,
    gender: {
      type: String,
    },
    // ✅ ADD THIS
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // ensures every listing is tied to a user
    },
    aadhaarNumber: {
      type: String,
      validate: {
        validator: function (v) {
          return /^\d{12}$/.test(v); // Validates 12-digit number
        },
        message: "Aadhaar number must be a 12-digit numeric value",
      },
      // Required field
      trim: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Priceplan",
      default: null,
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    lastPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },
    location: {
      address: String,
      addressLink: String,
      pincode: String,
      city: String,
      state: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    experience: { type: String },
    description: { type: String },
    phone: { type: String },
    website: String,
    email: {
      type: String,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, "Invalid email"],
    },
    socialLinks: {
      facebook: String,
      instagram: String,
      twitter: String,
      youtube: String,
      linkedin: String,
      Zomato: String,
      swiggy: String,
      amazon: String,
      flipkart: String,
      snapdeal: String,
      zepto: String,
      blinkit: String,
      meesho: String,
      myntra: String,
    },
    area: {
      type: String,
    },
    businessHours: [
      {
        day: { type: String, required: true },
        isWorking: { type: Boolean, default: true },
        is24Hour: { type: Boolean, default: false },
        is24HourClose: { type: Boolean, default: false },
        shifts: [
          {
            open: { type: String, default: "" }, // "HH:mm"
            close: { type: String, default: "" },
          },
        ],
      },
    ],
    profileImage: { type: String }, // single file path or URL
    coverImage: { type: String }, // single file path or URL

    certificateImages: [
      {
        type: String, // store paths or URLs to certificates
      },
    ],

    galleryImages: {
      type: [String],
      validate: {
        validator: function (val) {
          return val.length <= 10;
        },
        message: "galleryImages exceeds the limit of 10",
      },
    },
    aadhaarImages: {
      front: { type: String },
      back: { type: String },
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    // ✅ Newly added services field (as requested)
 services: {
    type:  mongoose.Schema.Types.Mixed,
    default: {}
},

    customService: {
      type: String,
      trim: true,
    },
  

    salesExecutive: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    revenue: { type: Number, default: 0 },

    category: { type: String, required: true }, // e.g., 'health-medical'
    // subCategory: { type: String, required: true }, // e.g., 'hospital', 'clinic', 'spa', 'salon'
    categoryRef: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "categoryModel",
    },
    categoryModel: { type: String, required: true }, // e.g., 'HealthMedical'
    // ✅ Review stats (newly added)
    averageRating: {
      type: Number,
      default: 0,
    },
    numberOfReviews: {
      type: Number,
      default: 0,
    },
    qrCodeUrl: {
  type: String,
  default: null,
},
quickLink: { type: String },
    // ✅ New fields for tracking views
    views: {
      type: Number,
      default: 0,
    },
    viewers: [
      {
        ip: String,
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    deleteBusiness: {
  type: Boolean,
  default: false,
},
isPremium: {
  type: Boolean,
  default: false,
},

    pricing: {
  label: { type: String, trim: true }, // e.g., "Consultation Fee", "Per Hour", "Per Day", "Per Month"
  amount: { type: Number, min: 0 },
  // currency: { type: String, default: "INR" }
}

  },

  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);
// ✅ Virtual field for associated reviews
businessSchema.virtual("reviews", {
  ref: "Review", // The model to use
  localField: "_id", // Find reviews where `business` = `_id`
  foreignField: "business", // In the Review model, the field to match
});

businessSchema.virtual("events", {
  ref: "Event",
  localField: "_id",
  foreignField: "business",
});

const Business = mongoose.model("Business", businessSchema);
export default Business;
