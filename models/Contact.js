import mongoose from "mongoose";

const contactSchema = new mongoose.Schema({
  
  owner: {                // jis user ne contact save kiya
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  contactUser: {          // jis user ko contact me add kiya
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  customName: {           // owner ne contactUser ko kis naam se save kiya
    type: String,
    default: null
  },

  // Contact-only block system (WhatsApp style)
  isBlocked: {           
    type: Boolean,
    default: false
  },

}, { timestamps: true });

// Prevent overwrite
const Contact = mongoose.models.Contact || mongoose.model("Contact", contactSchema);

export default Contact;
