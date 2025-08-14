// models/HealthMedical.js
import mongoose from 'mongoose';

const JewellerSchema = new mongoose.Schema({
  speciality: {
    type: String,
   
  },
  registerNumber: {
    type: String,
  },
  YearOfEstablishment: {
    type: String,
  },
  appointmentLink: {
    type: String,
  },
  affiliation: {
    type: String,
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

const Jeweller = mongoose.model('Jeweller', JewellerSchema);
export default Jeweller;
