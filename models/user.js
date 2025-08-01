import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  // username: {
  //   type: String,
  //   required: true,
  //   unique: true
  // },
  email: {
    type: String,
    required: true,
    unique: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email']
  },
  password: { 
    type: String, 
    required: true,
    minlength: 8 
  },
  
  role: {
    type: String,
    enum: ['customer', 'business', 'support', 'admin', 'superadmin', 'sales'],
    default: 'customer'
  },
   referralCode: { type: String, unique: true, sparse: true }, // ✅ Unique referral code
   referredBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  default: null
},

phone: {
    type: String,
  },
  city: { type: String },
  state: { type: String },
  country: { type: String },  
  zipCode: { type: String },
  isVerified: { type: Boolean, default: false },
  refreshTokens: [String],
  profile: {
    photo: { type: String },

    avatar: String
  }, 
  // Business-specific fields (nullable)
  // businessDetails: {
  //   name: String,
  //   licenseNumber: String
  // },
  emailVerifyOTP: String,
emailVerifyExpires: Date,
resetPasswordOTP: String,
resetPasswordExpires: Date,

}, { timestamps: true });

// Password hashing middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
//compare password
// ✅ Add method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};


export default mongoose.model('User', userSchema);