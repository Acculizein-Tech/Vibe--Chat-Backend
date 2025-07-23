// models/DeleteRequest.js
import mongoose from 'mongoose';

const deleteRequestSchema = new mongoose.Schema({
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // 🔄 Either user or business must be present (not both)
  userToDelete: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  businessToDelete: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    default: null
  },

  reason: {
    type: String,
    default: ''
  },

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  resolvedAt: {
    type: Date,
    default: null
  }

}, { timestamps: true });

const DeleteRequest = mongoose.models.DeleteRequest || mongoose.model('DeleteRequest', deleteRequestSchema);
export default DeleteRequest;
