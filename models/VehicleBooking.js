import mongoose from 'mongoose';

const driverSchema = new mongoose.Schema({
  fullName: String,
  licenseNumber: String,
  licenseValidity: Date,
  experienceYears: Number,
  languagesKnown: [String],
  uniformProvided: { type: String },
  backgroundVerified: { type: String },
  driverPhoto: String,
  licenseCopy: String
}, { _id: false });

const VehicleBookingSchema = new mongoose.Schema({
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
  typeOfOperator: {
    type: String,
  },
facilities: {
    type: mongoose.Schema.Types.Mixed,
    default:{}
  },
  pricingStructure: {
    baseFare: Number,
    minimumKMCharges: Number,
    perKMCharges: {
      city: Number,
      highway: Number,
      night: Number
    },
    waitingCharges: {
      per15min: Number,
      per30min: Number
    },
    tollParkingPolicy: String,
    specialCharges: {
      ac: Number,
      luggage: Number,
      extraPassenger: Number
    },
    flatRateRoutesNote: String,
    rateCardFile: String, // path to PDF/Image
    isNegotiable: Boolean
  },

  drivers: [driverSchema],

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
}, { timestamps: true });

const VehicleBooking = mongoose.model('VehicleBooking', VehicleBookingSchema);
export default VehicleBooking;
