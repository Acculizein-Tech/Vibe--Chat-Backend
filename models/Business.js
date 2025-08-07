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
    message: 'Aadhaar number must be a 12-digit numeric value',
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
      type: String
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
          back: { type: String }
        },

        isDeleted: {
          type: Boolean,
          default: false
        },

    // ✅ Newly added services field (as requested)
   services: {
  // Hotel services
  hotel: { type: Boolean, default: false },
  cafe: { type: Boolean, default: false },
  restaurant: { type: Boolean, default: false },
  bar: { type: Boolean, default: false },
  lounge: { type: Boolean, default: false },
  bakery: { type: Boolean, default: false },
  foodTruck: { type: Boolean, default: false },
  threeStarHotel: { type: Boolean, default: false },
  fourStarHotel: { type: Boolean, default: false },
  fiveStarHotel: { type: Boolean, default: false },
  sevenStarHotel: { type: Boolean, default: false },
  luxuryHotel: { type: Boolean, default: false },
  premiumHotel: { type: Boolean, default: false },
  heritageHotel: { type: Boolean, default: false },
  resort: { type: Boolean, default: false },
  lodge: { type: Boolean, default: false },
  villa: { type: Boolean, default: false },
  café: { type: Boolean, default: false },
  restaurents: { type: Boolean, default: false },

  // BeautySpa services
  unisexSalon: { type: Boolean, default: false },
  ladiesOnly: { type: Boolean, default: false },
  gentsOnly: { type: Boolean, default: false },
  spa: { type: Boolean, default: false },
  beautyParlour: { type: Boolean, default: false },

  // Education
  school: { type: Boolean, default: false },
  college: { type: Boolean, default: false },
  coachingInstitute: { type: Boolean, default: false },
  trainingCenter: { type: Boolean, default: false },
  university: { type: Boolean, default: false },

  // Health services
  clinic: { type: Boolean, default: false },
  hospital: { type: Boolean, default: false },
  diagnosticCentre: { type: Boolean, default: false },
  nursingHome: { type: Boolean, default: false },
  multispecialityHospital: { type: Boolean, default: false },
  healthCheckupCentre: { type: Boolean, default: false },
  pharmacyMedicalStore: { type: Boolean, default: false },
  ayurvedicStore: { type: Boolean, default: false },
  homeopathyStore: { type: Boolean, default: false },
  surgicalEquipmentSupplier: { type: Boolean, default: false },
  onlinePharmacy: { type: Boolean, default: false },
  pathologyLab: { type: Boolean, default: false },
  radiologyCentreXrayMriCt: { type: Boolean, default: false },
  bloodTestingLab: { type: Boolean, default: false },
  covidTestingCenter: { type: Boolean, default: false },
  naturopathy: { type: Boolean, default: false },
  acupuncture: { type: Boolean, default: false },
  yogaTherapyCentre: { type: Boolean, default: false },
  unaniClinic: { type: Boolean, default: false },
  other: { type: Boolean, default: false },

  // Garment
  retailStore: { type: Boolean, default: false },
  boutique: { type: Boolean, default: false },
  showroom: { type: Boolean, default: false },
  mart: { type: Boolean, default: false },
  franchise: { type: Boolean, default: false },
  fashionHouse: { type: Boolean, default: false },

  // Groceries
  groceryStore: { type: Boolean, default: false },
  supermarket: { type: Boolean, default: false },
  generalStore: { type: Boolean, default: false },
  kirana: { type: Boolean, default: false },
  departmental: { type: Boolean, default: false },
  organicStore: { type: Boolean, default: false },

  // Shoes
  retailShop: { type: Boolean, default: false },
  wholesale: { type: Boolean, default: false },
  manufacturer: { type: Boolean, default: false },
  brandOutlet: { type: Boolean, default: false },
  exporter: { type: Boolean, default: false },
  eCommerce: { type: Boolean, default: false },
  franchise: { type: Boolean, default: false },

  // Travels
  travelAgency: { type: Boolean, default: false },
  tourOperator: { type: Boolean, default: false },
  visaConsultant: { type: Boolean, default: false },
  travelPortal: { type: Boolean, default: false },
  adventureOrganizer: { type: Boolean, default: false },

  // Insurance
  individualAgent: { type: Boolean, default: false },
  corporateAgency: { type: Boolean, default: false },
  broker: { type: Boolean, default: false },
  insuranceCompany: { type: Boolean, default: false },
  onlinePortal: { type: Boolean, default: false },
  consultant: { type: Boolean, default: false },

  // Real-Estate
  realEstateAgency: { type: Boolean, default: false },
  individualBroker: { type: Boolean, default: false },
  builder: { type: Boolean, default: false },
  developer: { type: Boolean, default: false },
  propertyConsultant: { type: Boolean, default: false },

  // Loan
  LoanAgent: { type: Boolean, default: false },
  NBFC: { type: Boolean, default: false },
  BankRepresentative: { type: Boolean, default: false },
  FinanceConsultant: { type: Boolean, default: false },
  personalLoan: { type: Boolean, default: false },
  homeLoan: { type: Boolean, default: false },
  carLoan: { type: Boolean, default: false },
  businessLoan: { type: Boolean, default: false },
  educationLoan: { type: Boolean, default: false },
  goldLoan: { type: Boolean, default: false },
  mortgage: { type: Boolean, default: false },
  creditCards: { type: Boolean, default: false },

  // Gym
  gym: { type: Boolean, default: false },
  fitnessStudio: { type: Boolean, default: false },
  healthClub: { type: Boolean, default: false },
  weightTrainingCenter: { type: Boolean, default: false },
  cardioTrainingCenter: { type: Boolean, default: false },
  strengthTrainingFacility: { type: Boolean, default: false },
  fashionModelShoots: { type: Boolean, default: false },
babyFamilyPortraits: { type: Boolean, default: false },
productCatalogShoots: { type: Boolean, default: false },
corporateEventPhotography: { type: Boolean, default: false },

//VehicleBooking
individualDriver:{
  type: Boolean,
  default: false
},

fleetOwner: {
  type: Boolean,
  default: false
},

travelAgencyLogisticsCompany: {
  type: Boolean,
  default: false
},

emergencyServiceProvider: {
  type: Boolean,
  default: false
},
},

customService: {
  type: String,
  trim: true
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
