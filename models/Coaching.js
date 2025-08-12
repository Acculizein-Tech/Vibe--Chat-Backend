// models/HealthMedical.js
import mongoose from 'mongoose';

const CoachingSchema = new mongoose.Schema({
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
    GSTIN:{
    type: String,
  },
  consentGiven: {
    type: Boolean,
    default: false
  },
  facilities: {
   Science_Labs: { type: Boolean, default: false },
  AC_Class_Rooms: { type: Boolean, default: false },
  Computer_Labs: { type: Boolean, default: false },
  Library: { type: Boolean, default: false },
  Auditorium_Hall: { type: Boolean, default: false },
  Playground_And_Sports_Field: { type: Boolean, default: false },
  Cafeteria_Dining_Hall: { type: Boolean, default: false },
  Parking_Facility: { type: Boolean, default: false },
  Wheelchair_Access: { type: Boolean, default: false },
  Toilets_And_Sanitation: { type: Boolean, default: false },
  Separate_Male_And_Female_Staff: { type: Boolean, default: false },
  Waiting_Area: { type: Boolean, default: false },
  Medical_And_Nurse_Room: { type: Boolean, default: false },
  Digital_Smart_Classroom: { type: Boolean, default: false },
  Emergency_Exits_And_Fire_Safety: { type: Boolean, default: false }

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

const Coaching = mongoose.model('Coaching', CoachingSchema);
export default Coaching;
