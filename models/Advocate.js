import mongoose from 'mongoose';

const AdvocateSchema = new mongoose.Schema({
  speciality: {
    type: String,
    
  },
  registerNumber: {
    type: String,
    required: false,
    default: ''
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
  GSTIN: {
    type: String,
  },
  consentGiven: {
    type: Boolean,
    default: false
  },
  facilities: {
    // ✅ Newly added travel-related facilities
    civilLaw: { type: Boolean, default: false },
  criminalLaw: { type: Boolean, default: false },
  propertyRealEstateCases: { type: Boolean, default: false },
  corporateCompanyLaw: { type: Boolean, default: false },
  familyDivorceMatters: { type: Boolean, default: false },
  taxationGstCases: { type: Boolean, default: false },
  consumerCourtMatters: { type: Boolean, default: false },
  iprTrademarkRegistration: { type: Boolean, default: false },
  arbitrationLegalDrafting: { type: Boolean, default: false }
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

const Advocate = mongoose.model('Advocate', AdvocateSchema);
export default Advocate;
