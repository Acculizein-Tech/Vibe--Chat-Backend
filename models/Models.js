import mongoose from 'mongoose';

const ModelsSchema = new mongoose.Schema({
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
   acting: { type: Boolean, default: false },
  printShoot: { type: Boolean, default: false },
  sareesShoot: { type: Boolean, default: false },
  lehengaShoot: { type: Boolean, default: false },
  rampShows: { type: Boolean, default: false },
  designerShoot: { type: Boolean, default: false },
  ethenicWears: { type: Boolean, default: false },
  bikiniShoot: { type: Boolean, default: false },
  lingerieShoots: { type: Boolean, default: false },
  swimSuits: { type: Boolean, default: false },
  calendarShoots: { type: Boolean, default: false },
  musicAlbum: { type: Boolean, default: false },
  tvSerial: { type: Boolean, default: false },
  kissingScenes: { type: Boolean, default: false },
  singing: { type: Boolean, default: false },
  dancing: { type: Boolean, default: false },
  anchoring: { type: Boolean, default: false },
  webSeries: { type: Boolean, default: false },
  indianWear: { type: Boolean, default: false },
  skirt: { type: Boolean, default: false },
  shorts: { type: Boolean, default: false },
  bold: { type: Boolean, default: false },
  topless: { type: Boolean, default: false },
  nude: { type: Boolean, default: false },
  semiNude: { type: Boolean, default: false },
  bodyPainting: { type: Boolean, default: false },
  compromise: { type: Boolean, default: false },
  adjustments: { type: Boolean, default: false },
  anyAllergiesToDust: { type: Boolean, default: false },
  passport: { type: Boolean, default: false },
  tattoo: { type: Boolean, default: false },
  outStationShoot: { type: Boolean, default: false },
  outCountryShoot: { type: Boolean, default: false }
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
