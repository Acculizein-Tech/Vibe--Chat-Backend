// models/HealthMedical.js
import mongoose from 'mongoose';

const DoctorSchema = new mongoose.Schema({
  speciality: {
    type: String,
   
  },
  registerNumber: {
    type: String,
    
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
  },
  consentGiven: {
    type: Boolean,
    default: false
  },
  facilities: {
    PrivateRooms: { type: Boolean, default: false },
    AC: { type: Boolean, default: false },
    Credit_Card_Payment: { type: Boolean, default: false },
    UPI_Payment: { type: Boolean, default: false },
    Catering_Services_Available: { type: Boolean, default: false },
    Private_Dining_And_Cabins_Rooms: { type: Boolean, default: false },
    Kids_Zone_And_Family_Friendly: { type: Boolean, default: false },
    Parking_Facility: { type: Boolean, default: false },
    Wheelchair_Access: { type: Boolean, default: false },
    WaitingArea: { type: Boolean, default: false },
    Ambulance: { type: Boolean, default: false },
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

const Doctor = mongoose.model('Doctor', DoctorSchema);
export default Doctor;
