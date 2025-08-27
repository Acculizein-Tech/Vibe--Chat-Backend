// scripts/assignReferralCodes.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user.js"; // adjust path if needed
import { generateReferralCode } from "../utils/generateReferralCode.js";

dotenv.config(); // load MONGO_URI from .env

export const assignReferralCodes = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    // Find all users without a valid referralCode
    const usersWithoutReferral = await User.find({
      $or: [
        { referralCode: { $exists: false } },
        { referralCode: null },
        { referralCode: "" },
      ],
    });

    if (usersWithoutReferral.length === 0) {
      console.log("👌 All users already have referral codes.");
      mongoose.connection.close();
      return;
    }

    console.log(`🔍 Found ${usersWithoutReferral.length} users without referralCode`);

    for (const user of usersWithoutReferral) {
      let unique = false;
      let newCode;

      while (!unique) {
        newCode = generateReferralCode();
        const exists = await User.findOne({ referralCode: newCode });
        if (!exists) {
          unique = true;
        }
      }

      user.referralCode = newCode;
      await user.save();

      console.log(
        `✅ Assigned referralCode "${newCode}" to ${user.email || "Unknown Email"}`
      );
    }

    console.log("🎉 Referral codes assigned to all missing users!");
    mongoose.connection.close();
  } catch (err) {
    console.error("❌ Error assigning referral codes:", err.message);
    mongoose.connection.close();
  }
};
 assignReferralCodes();
