// models/Event.js
import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  business: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Business',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: String,

  // Time range
  startTime: {
    type: Date,
    required: true
  },
  endTime: {
    type: Date,
    required: true
  },

  // Optional link (e.g. for registration, details)
  link: {
    type: String,
    default: ''
  },

  // Optional address/location of the event
  location: {
    type: String,
    default: ''
  },

  // Flag for admin approval
  isApproved: {
    type: Boolean,
    default: false
  },

  // Optional image/banner
  eventImages: {
    type: String // file path or URL //eventImages
  }

}, {
  timestamps: true
});

const Event = mongoose.model('Event', eventSchema);
export default Event;
