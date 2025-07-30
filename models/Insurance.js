// models/HealthMedical.js
import mongoose from "mongoose";

const InsuranceSchema = new mongoose.Schema({
  speciality: {
    type: String,
    required: true,
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
    required: false,
    unique: true,
  },
  consentGiven: {
    type: Boolean,
    default: false,
  },
  facilities: {
    Health_Insurance: { type: Boolean, default: false },
    Motor_Insurance: { type: Boolean, default: false },
    Home_Insurance: { type: Boolean, default: false },
    Travel_Insurance: { type: Boolean, default: false },
    Commercial_Insurance: { type: Boolean, default: false },
    Term_Life_Insurance: { type: Boolean, default: false },
    Whole_Life_Policy: { type: Boolean, default: false },
    Pension_Annuity_Plans: { type: Boolean, default: false },
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
