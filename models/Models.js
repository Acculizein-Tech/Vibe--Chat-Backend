import mongoose from 'mongoose';

const ModelsSchema = new mongoose.Schema({
  speciality: {   
    type: String,
    
  },
  registerNumber: {
    type: String
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
    type: String
  },
  consentGiven: {
    type: Boolean,
    default: false
  },
facilities: {
    type: mongoose.Schema.Types.Mixed,
    default:{}
  },

 // ✅ Separate model form fields
  height: { type: String, default: '' }, // e.g., "5'8\""
  weight: { type: String, default: '' }, // in kg or lbs
  bust: { type: String, default: '' }, // fullest part of chest
  skinTone: { type: String, default: '' }, // below chest
  waist: { type: String, default: '' }, // natural waist
  hairColour: { type: String, default: '' }, // just below bust
  shoeSize: { type: String, default: '' }, // above hips
  hips: { type: String, default: '' }, // widest part of hips
  bodyType: { type: String, default: '' }, // upper thigh
  maritalStatus: { type: String, default: '' }, // calf
  presentProfession: { type: String, default: '' }, // shoulders
  education: { type: String, default: '' },
  hobbies: { type: String, default: '' }, // bicep
  language: { type: String, default: '' }, // language skills

   hobbies: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
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

const Models = mongoose.model('Models', ModelsSchema);
export default Models;
