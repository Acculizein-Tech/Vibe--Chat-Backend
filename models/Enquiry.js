// models/HealthMedical.js
import mongoose from 'mongoose';

const EnquirySchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    default: ''
  },
  phone: {
    type: Number,
    required: true
  },
  businessName: {
    type: String,
    
  },
subject: {
  type: String,
  default: 'General Inquiry'
},
  message: {
    type: String,
    required: true
  },
}, { timestamps: true });

const Enquiry = mongoose.model('Enquiry', EnquirySchema);
export default Enquiry;
