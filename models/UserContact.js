import mongoose from "mongoose";

const userContactSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // fast lookup
    },

    firstName: {
      type: String,
      required: true,
    },
      lastName: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    phoneHash: {
      type: String,
      index: true,
    },

    // if this contact is a registered user
    linkedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isOnPlatform: {
      type: Boolean,
      default: false,
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

userContactSchema.index(
  { owner: 1, phoneHash: 1 },
  { unique: true } // same contact twice not allowed
);

const UserContact =
  mongoose.models.UserContact ||
  mongoose.model("UserContact", userContactSchema);

export default UserContact;
