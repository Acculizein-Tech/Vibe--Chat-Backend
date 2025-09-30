import mongoose from 'mongoose';

const PeopleDirectorySchema = new mongoose.Schema({
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
  GSTIN: {
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

   // ✅ Separate model form fields
  height: { type: String, default: '' }, // e.g., "5'8\""
  weight: { type: String, default: '' }, // in kg or lbs
  bust: { type: String, default: '' }, // fullest part of chest
  skinTone: { type: String, default: '' }, // below chest
  eyeColour: { type: String, default: '' }, // just below bust
  hairColour: { type: String, default: '' }, // just below bust
  nationality: { type: String, default: '' }, // above hips
  religion: { type: String, default: '' }, // widest part of hips
  caste: { type: String, default: '' }, // upper thigh
  maritalStatus: { type: String, default: '' }, // calf
  presentProfession: { type: String, default: '' }, // shoulders
  education: { type: String, default: '' },
  
  language: { type: String, default: '' }, // language skills
  awards: { type: String, default: '' }, // awards and recognitions

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

const PeopleDirectory = mongoose.model('PeopleDirectory', PeopleDirectorySchema);
export default PeopleDirectory;
