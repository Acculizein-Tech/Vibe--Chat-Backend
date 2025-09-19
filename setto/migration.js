// migrateQrCodes.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import Business from "../models/Business.js";
import { generateAndUploadQrCode } from "../middlewares/generateQrCode.js";

dotenv.config();

const runMigration = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ DB connected");

   const businesses = await Business.find({
  $or: [
    { qrCodeUrl: null },
    { quickLink: null }
  ]
});


    console.log(`📌 Found ${businesses.length} businesses to update`);

    for (const business of businesses) {
      if (!business.category) {
        console.warn(`⚠️ Skipping ${business._id} (no categorySlug)`);
        continue;
      }

      // 🟢 Generate fresh QR + quickLink
      const qrData = await generateAndUploadQrCode(
        business._id.toString(),
        business.category
      );

      business.qrCodeUrl = qrData.qrCodeUrl;
      business.quickLink = qrData.quickLink;

      await business.save();
      console.log(`✅ Updated business ${business._id}`);
    }

    console.log("🎉 Migration completed successfully");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
};

runMigration();
