import mongoose from 'mongoose';

const GroceriesSchema = new mongoose.Schema({
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
  facilities: {
    // ✅ Newly added travel-related facilities
    parkingAccessibility: { type: Boolean, default: false },
  dairyRefrigeratedGoods: { type: Boolean, default: false },
  frozenFoods: { type: Boolean, default: false },
  meatSeafoodDeli: { type: Boolean, default: false },
  bakeryFreshGoods: { type: Boolean, default: false },
  pantryCannedGoods: { type: Boolean, default: false },
  householdEssentialsToiletries: { type: Boolean, default: false },
  healthWellnessMedicine: { type: Boolean, default: false },
  checkoutCheckout: { type: Boolean, default: false },
  onlineOrderingDelivery: { type: Boolean, default: false },
  loyaltyDiscountPrograms: { type: Boolean, default: false },
  inventoryStockManagement: { type: Boolean, default: false },
  inStorePromotionsSampling: { type: Boolean, default: false },
  customerServiceDesk: { type: Boolean, default: false },
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

const Groceries = mongoose.model('Groceries', GroceriesSchema);
export default Groceries;
