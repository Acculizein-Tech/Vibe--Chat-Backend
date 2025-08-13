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
    doctor: { type: Boolean, default: false },
  passenger_transport: { type: Boolean, default: false },
  goods_logistics: { type: Boolean, default: false },
  emergency_transport: { type: Boolean, default: false },
  luxury_wedding_vip: { type: Boolean, default: false },
  construction_utility_vehicles: { type: Boolean, default: false },
  hotel: { type: Boolean, default: false },
  cafe: { type: Boolean, default: false },
  restaurant: { type: Boolean, default: false },
  bar: { type: Boolean, default: false },
  lounge: { type: Boolean, default: false },
  bakery: { type: Boolean, default: false },
  food_truck: { type: Boolean, default: false },
  three_star_hotel: { type: Boolean, default: false },
  four_star_hotel: { type: Boolean, default: false },
  five_star_hotel: { type: Boolean, default: false },
  seven_star_hotel: { type: Boolean, default: false },
  luxury_hotel: { type: Boolean, default: false },
  premium_hotel: { type: Boolean, default: false },
  heritage_hotel: { type: Boolean, default: false },
  resort: { type: Boolean, default: false },
  lodge: { type: Boolean, default: false },
  villa: { type: Boolean, default: false },
  café: { type: Boolean, default: false },
  restaurents: { type: Boolean, default: false },
  unisex_salon: { type: Boolean, default: false },
  ladies_only: { type: Boolean, default: false },
  men_salon: { type: Boolean, default: false },
  gents_only: { type: Boolean, default: false },
  spa: { type: Boolean, default: false },
  beauty_parlour: { type: Boolean, default: false },
  college: { type: Boolean, default: false },
  coaching: { type: Boolean, default: false },
  school: { type: Boolean, default: false },
  training_center: { type: Boolean, default: false },
  university: { type: Boolean, default: false },
  individual_lawyer: { type: Boolean, default: false },
  law_firm: { type: Boolean, default: false },
  legal_consultant: { type: Boolean, default: false },
  clinic: { type: Boolean, default: true },
  hospital: { type: Boolean, default: true },
  diagnostic_centre: { type: Boolean, default: true },
  nursing_home: { type: Boolean, default: false },
  multispeciality_hospital: { type: Boolean, default: false },
  health_checkup_centre: { type: Boolean, default: false },
  pharmacy: { type: Boolean, default: false },
  ayurvedic_store: { type: Boolean, default: false },
  homeopathy_store: { type: Boolean, default: false },
  surgical_equipment_supplier: { type: Boolean, default: false },
  online_pharmacy: { type: Boolean, default: false },
  pathology_lab: { type: Boolean, default: false },
  radiology_centre_xray_mri_ct: { type: Boolean, default: false },
  blood_testing_lab: { type: Boolean, default: false },
  covid_testing_center: { type: Boolean, default: false },
  naturopathy: { type: Boolean, default: false },
  acupuncture: { type: Boolean, default: false },
  yoga_therapy_centre: { type: Boolean, default: false },
  unani_clinic: { type: Boolean, default: false },
  other: { type: Boolean, default: false },
  retail_store: { type: Boolean, default: false },
  boutique: { type: Boolean, default: false },
  showroom: { type: Boolean, default: false },
  mart: { type: Boolean, default: false },
  franchise: { type: Boolean, default: false },
  fashion_house: { type: Boolean, default: false },
  grocery_store: { type: Boolean, default: false },
  supermarket: { type: Boolean, default: false },
  general_store: { type: Boolean, default: false },
  kirana: { type: Boolean, default: false },
  departmental: { type: Boolean, default: false },
  organic_store: { type: Boolean, default: false },
  retail_shop: { type: Boolean, default: false },
  wholesale: { type: Boolean, default: false },
  manufacturer: { type: Boolean, default: false },
  brand_outlet: { type: Boolean, default: false },
  exporter: { type: Boolean, default: false },
  e_commerce: { type: Boolean, default: false },
  travel_agency: { type: Boolean, default: false },
  tour_operator: { type: Boolean, default: false },
  visa_consultant: { type: Boolean, default: false },
  travel_portal: { type: Boolean, default: false },
  adventure_organizer: { type: Boolean, default: false },
  individual_agent: { type: Boolean, default: false },
  corporate_agency: { type: Boolean, default: false },
  broker: { type: Boolean, default: false },
  insurance_company: { type: Boolean, default: false },
  online_portal: { type: Boolean, default: false },
  consultant: { type: Boolean, default: false },
  real_estate_agency: { type: Boolean, default: false },
  individual_broker: { type: Boolean, default: false },
  builder: { type: Boolean, default: false },
  developer: { type: Boolean, default: false },
  property_consultant: { type: Boolean, default: false },
  loan_agent: { type: Boolean, default: false },
  n_bfc: { type: Boolean, default: false },
  bank_representative: { type: Boolean, default: false },
  finance_consultant: { type: Boolean, default: false },
  personal_loan: { type: Boolean, default: false },
  home_loan: { type: Boolean, default: false },
  car_loan: { type: Boolean, default: false },
  business_loan: { type: Boolean, default: false },
  education_loan: { type: Boolean, default: false },
  gold_loan: { type: Boolean, default: false },
  mortgage: { type: Boolean, default: false },
  credit_cards: { type: Boolean, default: false },
  imitationjwellery: { type: Boolean, default: false },
  gym: { type: Boolean, default: false },
  fitness_studio: { type: Boolean, default: false },
  health_club: { type: Boolean, default: false },
  weight_training_center: { type: Boolean, default: false },
  cardio_training_center: { type: Boolean, default: false },
  strength_training_facility: { type: Boolean, default: false },
  retail: { type: Boolean, default: false },
  home_appliances: { type: Boolean, default: false },
  educational_toys: { type: Boolean, default: false },
  fashion_model_shoots: { type: Boolean, default: false },
  baby_family_portraits: { type: Boolean, default: false },
  product_catalog_shoots: { type: Boolean, default: false },
  corporate_event_photography: { type: Boolean, default: false },
  individual: { type: Boolean, default: false },
  agency: { type: Boolean, default: false },
  event_company_wedding: { type: Boolean, default: false },
  event_company_corporate_events: { type: Boolean, default: false },
  event_company_birthday: { type: Boolean, default: false },
  event_company_religious_events: { type: Boolean, default: false },
  model: { type: Boolean, default: false },
  influencer: { type: Boolean, default: false },
  actor: { type: Boolean, default: false },
  singer: { type: Boolean, default: false },
  comedian: { type: Boolean, default: false },
  dancer: { type: Boolean, default: false },
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
