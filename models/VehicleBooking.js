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
    enum: [
      'Individual Driver',
      'Fleet Owner',
      'Travel Agency / Logistics Company',
      'Emergency Service Provider'
    ]
  },
  facilities: {
    // ✅ Newly added travel-related facilities
    autoRickshaw: Boolean,
    eRickshaw: Boolean,
    hatchbackCar: Boolean,        // Alto, Kwid
    sedanCar: Boolean,            // Dzire, Etios
    suvMuv: Boolean,              // Ertiga, Innova, Xylo, Scorpio
    electricCars: Boolean,
    tempoTraveller: Boolean,      // 9 / 12 / 15 / 18 / 22 Seater
    schoolBus: Boolean,
    luxuryCar: Boolean,           // Limousine, Audi, BMW, Vintage
    weddingCarDecorated: Boolean,
    goodsCarrier: Boolean,        // Tata Ace, Bolero Pickup
    miniTruck: Boolean,
    bigTruck: Boolean,            // Open/Closed Body
    dumperTipper: Boolean,
    loaderCraneHydra: Boolean,
    waterTankerSandTruck: Boolean,
    ambulance: Boolean,           // Basic / ICU / Dead Body Van
    hearseVan: Boolean,
    coldStorageVehicle: Boolean,
    containerTrucks: Boolean,
    bikeTaxi: Boolean,
    cityRides: Boolean,
    outstationTrips: Boolean,     // One Way / Round Trip
    airportPickupDrop: Boolean,
    railwayPickupDrop: Boolean,
    schoolChildrenTransport: Boolean,
    staffTransportation: Boolean,
    weddingBooking: Boolean,      // Barat Booking
    eventLogistics: Boolean,      // VIP Transport
    parcelDelivery: Boolean,
    industrialTransport: Boolean, // Construction Material
    ambulanceOnCall: Boolean,
    funeralTransport: Boolean,
    hourlyRental: Boolean,
    monthlyContracts: Boolean,    // Schools / Companies / Agencies
    pointToPointBooking: Boolean,
    dayNightRental: Boolean
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
