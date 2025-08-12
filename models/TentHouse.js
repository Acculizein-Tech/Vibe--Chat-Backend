// models/HealthMedical.js
import mongoose from 'mongoose';

const TentHouseSchema = new mongoose.Schema({
  speciality: {
    type: String,
    
  },
  registerNumber: {
    type: String,
  },
  YearOfEstablishment: {
    type: String,
    required: false,
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
   WeddingStageDecoration: { type: Boolean, default: false },
  MandapLightingSetup: { type: Boolean, default: false },
  BirthdayPartyDecoration: { type: Boolean, default: false },
  CorporateEventSetup: { type: Boolean, default: false },
  CateringTieupOptional: { type: Boolean, default: false },
  ThemeBasedDecoration: { type: Boolean, default: false },
  FlowerDecorationBalloonDecoration: { type: Boolean, default: false },
  DJSoundSetup: { type: Boolean, default: false }

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

const TentHouse = mongoose.model('TentHouse', TentHouseSchema);
export default TentHouse;
