// models/HealthMedical.js
import mongoose from 'mongoose';

const EVChargingPointSchema = new mongoose.Schema({
  location: {
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

const EVChargingPoint = mongoose.model('EVChargingPoint', EVChargingPointSchema);
export default EVChargingPoint;
