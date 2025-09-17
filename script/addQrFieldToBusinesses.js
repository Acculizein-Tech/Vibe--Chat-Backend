import mongoose from "mongoose";
import dotenv from "dotenv";
import Business from "../models/Business.js";

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    // Update all businesses where qrCodeUrl does not exist
    const result = await Business.updateMany(
      { qrCodeUrl: { $exists: false } },
      { $set: { qrCodeUrl: null } }
    );

    console.log(`🎉 Updated ${result.modifiedCount} businesses`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error updating businesses:", err);
    process.exit(1);
  }
};

run();
