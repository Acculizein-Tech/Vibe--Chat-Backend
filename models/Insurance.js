// models/HealthMedical.js
import mongoose from "mongoose";

const InsuranceSchema = new mongoose.Schema({
  speciality: {
    type: String,
  
  },
  registerNumber: {
    type: String,
    required: false,
    default: "",
  },
  YearOfEstablishment: {
    type: String,
    required: false,
    default: "",
  },
  appointmentLink: {
    type: String,
    default: "",
  },
  affiliation: {
    type: String,
    default: "",
  },
  GSTIN: {
    type: String,
 
  },
  consentGiven: {
    type: Boolean,
    default: false,
  },
  facilities: {
    healthInsurance: { type: Boolean, default: false },
    motorInsurance: { type: Boolean, default: false },
    homeInsurance: { type: Boolean, default: false },
    travelInsurance: { type: Boolean, default: false },
    commercialInsurance: { type: Boolean, default: false },
    termLifeInsurance: { type: Boolean, default: false },
    wholeLifePolicy: { type: Boolean, default: false },
    pensionAnnuityPlans: { type: Boolean, default: false },
  },
  extraFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",
    required: true,
  },
});

const Insurance = mongoose.model("Insurance", InsuranceSchema);
export default Insurance;
