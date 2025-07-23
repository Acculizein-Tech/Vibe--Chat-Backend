// models/BeautySpa.js
import mongoose from 'mongoose';

const beautySpaSchema = new mongoose.Schema({
  speciality: {
    type: String,
    required: true
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
  consentGiven: {
    type: Boolean,
    default: false
  },
  facilities: {
    PrivateRooms: { type: Boolean, default: false },
    AC: { type: Boolean, default: false },
    Laundry: { type: Boolean, default: false },
    WiFiAvailable: { type: Boolean, default: false },
    CateringServicesAvailable: { type: Boolean, default: false },
    PrivateDiningAndCabinsRooms: { type: Boolean, default: false },
    KidsZoneAndFamilyFriendly: { type: Boolean, default: false },
    ParkingFacility: { type: Boolean, default: false },
    WheelchairAccess: { type: Boolean, default: false },
    HygienicToolsAndDisposableItems: { type: Boolean, default: false },
    SeparateMaleAndFemaleStaff: { type: Boolean, default: false },
    WaitingArea: { type: Boolean, default: false },
    LiveMusicAndDJAndBar: { type: Boolean, default: false },
    IndoorSeatingAndOutdoorSeating: { type: Boolean, default: false },
    RooftopAndGardenSeating: { type: Boolean, default: false },
    PetFriendly: { type: Boolean, default: false },
    InHouseDelivery: { type: Boolean, default: false },
    RefundAndCancellationAvailable: { type: Boolean, default: false },
    Memberships: { type: Boolean, default: false }
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

const BeautySpa = mongoose.model('BeautySpa', beautySpaSchema);
export default BeautySpa;
