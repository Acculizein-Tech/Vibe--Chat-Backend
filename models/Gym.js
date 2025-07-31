// models/HealthMedical.js
import mongoose from 'mongoose';

const GymSchema = new mongoose.Schema({
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
    acNonAC: { type: Boolean, default: false },
  parkingFacility: { type: Boolean, default: false },
  lockerRooms: { type: Boolean, default: false },
  changingRoomsShowers: { type: Boolean, default: false },
  steamSauna: { type: Boolean, default: false },
  swimmingPoolIfAny: { type: Boolean, default: false },
  personalTrainerDesk: { type: Boolean, default: false },
  dietNutritionConsultation: { type: Boolean, default: false },
  physiotherapySupportYesNo: { type: Boolean, default: false },
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

const Gym = mongoose.model('Gym', GymSchema);
export default Gym;
