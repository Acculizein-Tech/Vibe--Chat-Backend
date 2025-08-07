import mongoose from 'mongoose';

const driverSchema = new mongoose.Schema({
  fullName: String,
  licenseNumber: String,
  licenseValidity: Date,
  experienceYears: Number,
  languagesKnown: [String],
  uniformProvided: { type: Boolean, default: false },
  backgroundVerified: { type: Boolean, default: false },
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
  autoRickshaw: { type: Boolean, default: false },
  eRickshaw: { type: Boolean, default: false },
  hatchbackCar: { type: Boolean, default: false },        // Alto, Kwid
  sedanCar: { type: Boolean, default: false },            // Dzire, Etios
  suvMuv: { type: Boolean, default: false },              // Ertiga, Innova, Xylo, Scorpio
  electricCars: { type: Boolean, default: false },
  tempoTraveller: { type: Boolean, default: false },      // 9 / 12 / 15 / 18 / 22 Seater
  schoolBus: { type: Boolean, default: false },
  luxuryCar: { type: Boolean, default: false },           // Limousine, Audi, BMW, Vintage
  weddingCarDecorated: { type: Boolean, default: false },
  goodsCarrier: { type: Boolean, default: false },        // Tata Ace, Bolero Pickup
  miniTruck: { type: Boolean, default: false },
  bigTruck: { type: Boolean, default: false },            // Open/Closed Body
  dumperTipper: { type: Boolean, default: false },
  loaderCraneHydra: { type: Boolean, default: false },
  waterTankerSandTruck: { type: Boolean, default: false },
  ambulance: { type: Boolean, default: false },           // Basic / ICU / Dead Body Van
  hearseVan: { type: Boolean, default: false },
  coldStorageVehicle: { type: Boolean, default: false },
  containerTrucks: { type: Boolean, default: false },
  bikeTaxi: { type: Boolean, default: false },
  cityRides: { type: Boolean, default: false },
  outstationTrips: { type: Boolean, default: false },     // One Way / Round Trip
  airportPickupDrop: { type: Boolean, default: false },
  railwayPickupDrop: { type: Boolean, default: false },
  schoolChildrenTransport: { type: Boolean, default: false },
  staffTransportation: { type: Boolean, default: false },
  weddingBooking: { type: Boolean, default: false },      // Barat Booking
  eventLogistics: { type: Boolean, default: false },      // VIP Transport
  parcelDelivery: { type: Boolean, default: false },
  industrialTransport: { type: Boolean, default: false }, // Construction Material
  ambulanceOnCall: { type: Boolean, default: false },
  funeralTransport: { type: Boolean, default: false },
  hourlyRental: { type: Boolean, default: false },
  monthlyContracts: { type: Boolean, default: false },    // Schools / Companies / Agencies
  pointToPointBooking: { type: Boolean, default: false },
  dayNightRental: { type: Boolean, default: false }
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
