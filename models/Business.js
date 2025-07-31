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
    phone: { type: Number },
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

    // businessHours: [
    //   {
    //     day: { type: String, required: true },
    //     open: { type: String, default: "" },  // Use "HH:mm" format
    //     close: { type: String, default: "" }  // Use "HH:mm" format
    //   }
    // ],

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
    // ✅ Newly added services field (as requested)
    services: {
      EventsAvailable: { type: Boolean, default: false },
      Birthdays: { type: Boolean, default: false },
      WeddingParties: { type: Boolean, default: false },
      CorporateMeetings: { type: Boolean, default: false },
      HairCare: { type: Boolean, default: false },
      SkinCare: { type: Boolean, default: false },
      SpaServices: { type: Boolean, default: false },
      BridalAndPartyMakeup: { type: Boolean, default: false },
      NailArtExtensions: { type: Boolean, default: false },
      WaxingThreadingBleach: { type: Boolean, default: false },
      ManicurePedicure: { type: Boolean, default: false },
      TattooPiercing: { type: Boolean, default: false },
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
