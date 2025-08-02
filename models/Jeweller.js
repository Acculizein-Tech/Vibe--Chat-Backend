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
    Custom_Jewellery_Design: { type: Boolean, default: false },
    Repair_Polishing: { type: Boolean, default: false },
    Gold_Silver_Purchase_Exchange: { type: Boolean, default: false },
    Old_Gold_Silver_Evaluation_Buyback: { type: Boolean, default: false },
    EMI_Facility: { type: Boolean, default: false },
    Parking_Facility: { type: Boolean, default: false },
    Wheelchair_Access: { type: Boolean, default: false },
    WaitingArea: { type: Boolean, default: false },
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
