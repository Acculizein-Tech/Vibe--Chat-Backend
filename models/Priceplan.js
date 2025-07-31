import mongoose from 'mongoose';

const featureSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true
    }
  },
  { _id: false } // disables separate _id for each feature item
);

const pricePlanSchema = new mongoose.Schema(
  {
    priceName: {
      type: String,
      required: true,
      trim: true
    },
    price: {
      type: Number,
      required: true
    },
    duration: {
      type: String,
     
      
      default: ''
    },
    features: {
      type: [featureSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

const Priceplan = mongoose.model('Priceplan', pricePlanSchema);
export default Priceplan;
