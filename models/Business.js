// models/Business.js
import mongoose from 'mongoose';

// const mongoose = require('mongoose');
function arrayLimit(val) {
  return val.length <= 10;
}


const businessSchema = new mongoose.Schema({
  name: { type: String, required: true },
  ownerName: String,
   // ✅ ADD THIS
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true // ensures every listing is tied to a user
  },
  plan: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Priceplan',
  default: null
},
  location: {
    address: String,
    pincode: String,
    city: String,
    state: String,
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  experience: {type: String, require:true},
  description:{type: String, require:true},
  phone: { type: Number, required: true },
  website: String,
  email: {
    type: String,
    required: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email']
  },
  socialLinks: {
    facebook: String,
    instagram: String,
    twitter: String,
    youtube: String,
    linkedin: String
  },
  // businessHours: {
  // monday: {
  //   open: String,
  //   close: String,
  //   isOpen24Hours: { type: Boolean, default: false }
  // },
  // businessHours: {
  //   monday: { open: String, close: String },
  //   tuesday: { open: String, close: String },
  //   wednesday: { open: String, close: String },
  //   thursday: { open: String, close: String },
  //   friday: { open: String, close: String },
  //   saturday: { open: String, close: String },
  //   sunday: { open: String, close: String },
  //   // ...repeat for other days
  // },
  businessHours: [
    {
      day: { type: String, required: true },
      open: { type: String, default: "" },  // Use "HH:mm" format
      close: { type: String, default: "" }  // Use "HH:mm" format
    }
  ],
   profileImage: { type: String }, // single file path or URL
   coverImage: { type: String }, // single file path or URL

  certificateImages: [{
    type: String // store paths or URLs to certificates
  }],

 galleryImages: {
  type: [String],
  validate: {
    validator: function (val) {
      return val.length <= 10;
    },
    message: 'galleryImages exceeds the limit of 10'
  }
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
    TattooPiercing: { type: Boolean, default: false }
  },
 salesExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  revenue: { type: Number, default: 0 },
 
  category: { type: String, required: true }, // e.g., 'health-medical'
  categoryRef: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'categoryModel'
  },
  categoryModel: { type: String, required: true }, // e.g., 'HealthMedical'
    // ✅ Review stats (newly added)
  averageRating: {
    type: Number,
    default: 0
  },
  numberOfReviews: {
    type: Number,
    default: 0
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
      ref: 'User',
      default: null,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
    },
  }
],

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
}); 
// ✅ Virtual field for associated reviews
businessSchema.virtual('reviews', {
  ref: 'Review', // The model to use
  localField: '_id', // Find reviews where `business` = `_id`
  foreignField: 'business', // In the Review model, the field to match
});

businessSchema.virtual('events', {
  ref: 'Event',
  localField: '_id',
  foreignField: 'business'
});

const Business = mongoose.model('Business', businessSchema);
export default Business;
