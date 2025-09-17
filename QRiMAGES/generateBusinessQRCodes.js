// scripts/generateBusinessQRCodes.js
import mongoose from "mongoose";
import QRCode from "qrcode";
import Business from "../models/Business.js"; // adjust path
import dotenv from "dotenv";

dotenv.config();

const BASE_URL = process.env.QRCODE_URL || "https://www.bizvility.com/categories";

const generateOldBusinessQRCodes = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const businesses = await Business.find({ qrCodeUrl: { $exists: false } }); 
    // ya agar null h
    // const businesses = await Business.find({ qrCodeUrl: null });

    console.log(`Found ${businesses.length} businesses without QR.`);

    for (let biz of businesses) {
      const businessUrl = `${BASE_URL}/${biz.category?.toLowerCase() || "others"}/${biz._id}`;
      const qrCodeDataUrl = await QRCode.toDataURL(businessUrl);

      biz.qrCodeUrl = qrCodeDataUrl;
      await biz.save();

      console.log(`✅ QR Generated for business: ${biz.name}`);
    }

    console.log("🎉 All old businesses updated with QR codes!");
    process.exit();
  } catch (err) {
    console.error("❌ Error generating QR codes:", err);
    process.exit(1);
  }
};

generateOldBusinessQRCodes();
