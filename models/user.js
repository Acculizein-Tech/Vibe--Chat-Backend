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
    // unique: true,
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


phone: {
    type: String,
  },
  phoneHash: { type: String, index: true }, // SHA256 of normalized phone

  city: { type: String },
  state: { type: String },
  country: { type: String },  
  zipCode: { type: String },
  isVerified: { type: Boolean, default: false },
  refreshTokens: [String],
  profile: {
    photo: { type: String },

    avatar: { type: String },
  },

  emailVerifyOTP: String,
emailVerifyExpires: Date,
emailResendBlock: Date, // 🟢 Add this line
 
resetPasswordOTP: String,
resetPasswordExpires: Date,

pushToken: {
  type: String,
  default: null,
}
,
isDeleted: { type: Boolean, default: false },
deletedAt: { type: Date, default: null },
customCodes: [
  {
    codeName: { type: String, required: true },      // Superadmin ka display name
    codeValue: { type: String, required: true },     // Flat discount amount
    validity: { type: Date, default: null },         // null => unlimited
    isActive: { type: Boolean, default: true },      // active/inactive
    generatedCode: { type: String, required: true }, // format: 6 capital + 2 numeric
    createdAt: { type: Date, default: Date.now },
  }
],
blockedUsers: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
],


  


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


// 🔹 Prevent OverwriteModelError
const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;