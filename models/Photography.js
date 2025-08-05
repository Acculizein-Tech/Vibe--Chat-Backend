// models/HealthMedical.js
import mongoose from 'mongoose';

const PhotographySchema = new mongoose.Schema({
  speciality: {
    type: String,
   
  },
  registerNumber: {
    type: String,
    
    default: ''
  },
  YearOfEstablishment: {
    type: String,
   
    default: ''
  },
  appointmentLink: {
    type: String,
    default: ''
  },
  affiliation: {
    type: String,
    default: ''
  },
  GSTIN:{
    type: String,
  },
  consentGiven: {
    type: Boolean,
    default: false
  },
  facilities: {
  weddingPhotography: { type: Boolean, default: false },
  preWeddingShoots: { type: Boolean, default: false },
  eventPhotography: { type: Boolean, default: false },
  portraitPortfolioShoots: { type: Boolean, default: false },
  productPhotography: { type: Boolean, default: false },
  studioSessions: { type: Boolean, default: false },
  droneAerialPhotography: { type: Boolean, default: false },
  fashionPhotography: { type: Boolean, default: false },
  candidPhotography: { type: Boolean, default: false },
  commercialAdvertisingPhotography: { type: Boolean, default: false }
},

  extraFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  }
});

const Photography = mongoose.model('Photography', PhotographySchema);
export default Photography;
