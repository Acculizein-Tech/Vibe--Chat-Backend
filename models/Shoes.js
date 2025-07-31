import mongoose from 'mongoose';

const ShoesSchema = new mongoose.Schema({
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
    required: false,
    default: ''
  },
  consentGiven: {
    type: Boolean,
    default: false
  },
  facilities: {
    // ✅ Newly added travel-related facilities
    men: { type: Boolean, default: false },
  women: { type: Boolean, default: false },
  kids: { type: Boolean, default: false },
  sneakersRunning: { type: Boolean, default: false },
  crossTrainersGym: { type: Boolean, default: false },
  basketballCourt: { type: Boolean, default: false },
  cleats: { type: Boolean, default: false },
  ankleBoots: { type: Boolean, default: false },
  hikingWorkBoots: { type: Boolean, default: false },
  combatMotorcycleBoots: { type: Boolean, default: false },
  cowboyWesternBoots: { type: Boolean, default: false },
  loafers: { type: Boolean, default: false },
  courtPumps: { type: Boolean, default: false },
  flatsShoes: { type: Boolean, default: false },
  slidesSandals: { type: Boolean, default: false },
  climbingOutdoor: { type: Boolean, default: false },
  diabeticTherapeutic: { type: Boolean, default: false },
  minimalistBarefoot: { type: Boolean, default: false },
  rainWaterproof: { type: Boolean, default: false },
  workSafetySteelToe: { type: Boolean, default: false },
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

const Shoes = mongoose.model('Shoes', ShoesSchema);
export default Shoes;
