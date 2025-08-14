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
    // ✅ Newly added travel-related facilities
    CustomOrdersAccepted: { type: Boolean, default: false },
    CustomizedFurnitureOrders: { type: Boolean, default: false },
    EMIOptionsAvailable: { type: Boolean, default: false },
    FreeConsultation: { type: Boolean, default: false },
    HomeDecorItemsLampsCurtainsWallArt: { type: Boolean, default: false },
    HomeDeliveryAvailable: { type: Boolean, default: false },
    InstallationAssemblySupport: { type: Boolean, default: false },
    InteriorDesigningServices: { type: Boolean, default: false },
    ModularKitchenWardrobes: { type: Boolean, default: false },
    OfficeFurniture: { type: Boolean, default: false },
    RenovationSpacePlanning: { type: Boolean, default: false },
    WoodenFurnitureBedsSofasDiningTables: { type: Boolean, default: false },
    courtPumps: { type: Boolean, default: false },
    flatsShoes: { type: Boolean, default: false },
    slidesSandals: { type: Boolean, default: false },
    climbingOutdoor: { type: Boolean, default: false },
    diabeticTherapeutic: { type: Boolean, default: false },
    minimalistBarefoot: { type: Boolean, default: false },
    rainWaterproof: { type: Boolean, default: false },
    workSafetySteelToe: { type: Boolean, default: false },
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
