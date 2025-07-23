import mongoose from 'mongoose';

const visitSchema = new mongoose.Schema({
  ip: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  page: { type: String, required: true }, // e.g., '/', '/listing/123', '/contact'
   category: String, // optional: 'health', 'food', etc.
  referrer: String, // optional: previous page
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model('Visit', visitSchema);
