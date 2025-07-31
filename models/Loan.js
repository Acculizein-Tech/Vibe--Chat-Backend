// models/HealthMedical.js
import mongoose from 'mongoose';

const LoanSchema = new mongoose.Schema({
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

    default: ''
  },
  consentGiven: {
    type: Boolean,
    default: false
  },
  facilities: {
    onlineLoanApplication: { type: Boolean, default: false },
  documentPickupFacility: { type: Boolean, default: false },
  freeEligibilityCheck: { type: Boolean, default: false },
  fastLoanDisbursal: { type: Boolean, default: false },
  minimalDocumentationRequired: { type: Boolean, default: false },
  balanceTransferOption: { type: Boolean, default: false },
  topUpLoanFacility: { type: Boolean, default: false },
  loanForLowCIBILScore: { type: Boolean, default: false },
  emiCalculatorSupport: { type: Boolean, default: false },
  doorstepServiceAvailable: { type: Boolean, default: false }
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

const Loan = mongoose.model('Loan', LoanSchema);
export default Loan;
