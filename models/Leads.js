import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
  name: String,
  contact: String,
  businessType: String,
  status: { type: String, enum: ['Not Listed', 'Interested', 'Pending', 'Converted'], default: 'Not Listed' },
  followUpDate: Date,
  notes: String,
  salesUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

export default mongoose.model('Lead', leadSchema); 