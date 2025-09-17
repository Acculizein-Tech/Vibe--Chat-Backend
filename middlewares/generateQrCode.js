import QRCode from "qrcode";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { uploadToS3 } from "../middlewares/upload.js"; // ✅ reuse upload.js

export const generateAndUploadQrCode = async (businessId, categorySlug) => {
  try {
    const profileUrl = `${process.env.QRCODE_URL}/${categorySlug}/${businessId}`;

    // Step 1: Generate QR code buffer
    const qrBuffer = await QRCode.toBuffer(profileUrl, {
      type: "png",
      width: 500,
      errorCorrectionLevel: "H",
    });

    // Step 2: Convert PNG → WebP
    const webpBuffer = await sharp(qrBuffer).webp({ lossless: true }).toBuffer();

    // Step 3: Fake file-like object (same as multer output)
    const fakeFile = {
      buffer: webpBuffer,
      originalname: `${businessId}-${uuidv4()}.webp`,
      mimetype: "image/webp",
    };

    // Step 4: Upload to S3
    const s3Data = await uploadToS3(fakeFile);
    // return s3Data; // ⚡ contains { success: true, url: 'S3 URL' }
     return { 
      success: true, 
      qrCodeUrl: s3Data.url,   // S3 QR Code
      quickLink: profileUrl    // Direct profile URL
    };
  } catch (err) {
    console.error("❌ QR Code generation failed:", err.message);
    throw new Error("QR Code generation failed");
  }
};
