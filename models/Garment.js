// models/HealthMedical.js
import mongoose from 'mongoose';

const GarmentSchema = new mongoose.Schema({
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
    GSTIN:{
    type: String,
  
    default: ''
  },
  consentGiven: {
    type: Boolean,
    default: false
  },
  facilities: {
    AC: { type: Boolean, default: false },
    CreditCardPayment: { type: Boolean, default: false },
    UPI_Payment: { type: Boolean, default: false },
    Wheelchair_Access: { type: Boolean, default: false },
    B2C: { type: Boolean, default: false },
    B2B: { type: Boolean, default: false },
    B2B_and_B2C: { type: Boolean, default: false },
    Home_Delivery: { type: Boolean, default: false },
    Gift_Wrapping_Service: { type: Boolean, default: false },
    Changing_Rooms: { type: Boolean, default: false },
    Waiting_Area: { type: Boolean, default: false },
    Customer_Rest_Area: { type: Boolean, default: false },
    Lighting_And_Signage: { type: Boolean, default: false },
    Parking: { type: Boolean, default: false },
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

const Garment = mongoose.model('Garment', GarmentSchema);
export default Garment;
