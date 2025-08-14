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
    type: mongoose.Schema.Types.Mixed,
    default:{}
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
