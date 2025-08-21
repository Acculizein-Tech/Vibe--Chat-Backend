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
    enum: ['General Inquiry', 'Technical Support', 'Billing', 'Business Enquiry About Basic Branding Plan', 'Healthcare Digital Marketing Services Break-Up'],
    default: 'General Inquiry'
  },
  message: {
    type: String,
    required: true
  },
}, { timestamps: true });

const Enquiry = mongoose.model('Enquiry', EnquirySchema);
export default Enquiry;
