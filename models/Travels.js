import mongoose from 'mongoose';

const TravelsSchema = new mongoose.Schema({
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
    Domestic_Tours: { type: Boolean, default: false },
    International_Tours: { type: Boolean, default: false },
    Adventure_Travel: { type: Boolean, default: false },
    Cruise_Packages: { type: Boolean, default: false },
    Sightseeing_and_Excursions: { type: Boolean, default: false },
    Travel_and_Visa_Services: { type: Boolean, default: false },
    Hotel_and_Transport_Bookings: { type: Boolean, default: false }
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

const Travels = mongoose.model('Travels', TravelsSchema);
export default Travels;
