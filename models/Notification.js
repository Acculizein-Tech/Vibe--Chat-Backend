// models/Notification.js
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    role: {
      type: String,
      enum: ['superadmin', 'admin', 'sales', 'customer', null],
      default: null
    },
    type: {
      type: String,
      enum: [
        'REVIEW_RECEIVED',
        'LEAD_GENERATED',
        'BUSINESS_CREATED',
        'CUSTOMER_ENQUIRY',
        'EVENT_REQUEST',
        'ADMIN_ALERT',
        'NEW_BUSINESS_BY_REFERRAL',
        'NEW_BUSINESS_LISTED',
        'NEW_ENQUIRY_CREATED'
      ],
      required: true
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model('Notification', notificationSchema);
