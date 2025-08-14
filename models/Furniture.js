import mongoose from "mongoose";

const FurnitureSchema = new mongoose.Schema({
  speciality: {
    type: String,
  },
  registerNumber: {
    type: String,
  },
  YearOfEstablishment: {
    type: String,
    required: false,
    default: "",
  },
  appointmentLink: {
    type: String,
    default: "",
  },
  affiliation: {
    type: String,
    default: "",
  },
  GSTIN: {
    type: String,
  },
  consentGiven: {
    type: Boolean,
    default: false,
  },
 facilities: {
     type: mongoose.Schema.Types.Mixed,
     default:{}
   },

  furniture: {
    brandsAvailable: {
      Durian: { type: Boolean, default: false },
      Godrej: { type: Boolean, default: false },
      LocalBrands: { type: Boolean, default: false },
    },
    materialUsed: {
      SolidWood: { type: Boolean, default: false },
      MDF: { type: Boolean, default: false },
      ParticleBoard: { type: Boolean, default: false },
      Steel: { type: Boolean, default: false },
      Glass: { type: Boolean, default: false },
    },
  },

  extraFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {},
  },
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",
    required: true,
  },
});

const Furniture = mongoose.model("Furniture", FurnitureSchema);
export default Furniture;
