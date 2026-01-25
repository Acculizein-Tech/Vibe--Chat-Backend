import express from "express";
import upload, { uploadToS3 } from "../middlewares/upload.js";
import moment from "moment-timezone"; // ✅ Add this

const router = express.Router();

const mediaFields = upload.fields([
  { name: "profileImage", maxCount: 1 },
  { name: "coverImage", maxCount: 1 },
  { name: "certificateImages", maxCount: 5 },
  { name: "galleryImages", maxCount: 100 },
  { name: "eventsImage", maxCount: 1 },
  { name: "aadhaarFront", maxCount: 1 }, // ✅ Aadhaar front photo
  { name: "aadhaarBack", maxCount: 1 }, // ✅ Aadhaar back photo
  { name: "driverPhoto", maxCount: 1 }, // ✅ New: Driver Photo
  { name: "licenseCopy", maxCount: 1 }, // ✅ New: License Copy
  { name: "others", maxCount: 5 }, // ✅ New field
  {name: "rewardImage", maxCount: 1},
  {name: "ryngales-profile", maxCount: 1}, // 🆕 NEW: Ryngales profile image


   // 🟢 Advertisement fields
  { name: "adImage", maxCount: 5 },
  { name: "adVideo", maxCount: 1 },

  {name : "qrCode", maxCount: 1}, // 🆕 NEW: Business QR code upload (usually 1 file
]);

// ✅ Multer wrapper
const handleUpload = (req, res, next) => {
  mediaFields(req, res, function (err) {
    if (err) {
      if (
        err.code === "LIMIT_UNEXPECTED_FILE" &&
        err.field === "galleryImages"
      ) {
        return res.status(400).json({
          success: false,
          message: "❌ You can upload maximum 100 images in galleryImages",
        });
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ success: false, message: "File size too large" });
      }
      if (err.code === "LIMIT_PART_COUNT") {
        return res
          .status(400)
          .json({ success: false, message: "Too many parts in request" });
      }

      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res
          .status(400)
          .json({
            success: false,
            message: `❌ Unexpected file field: ${err.field}`,
          });
      }
    }
    next();
  });
};

router.post("/upload", handleUpload, async (req, res) => {
  try {
    const uploadedFiles = {};
    const files = req.files || {};

    // Get current time in Asia/Kolkata
    const timestampIST = moment()
      .tz("Asia/Kolkata")
      .format("YYYY-MM-DD HH:mm:ss");

    // for (const field in files) {
    //   uploadedFiles[field] = [];

    //   for (const file of files[field]) {
    //     const s3Url = await uploadToS3(file, req);

    //     console.log(`📦 Uploaded ${file.originalname} at ${timestampIST}`); // ✅ Log IST time

    //     uploadedFiles[field].push({
    //       url: s3Url,
    //       uploadedAt: timestampIST, // ✅ Include timestamp in response
    //     });
    //   }
    // }
    for (const field in files) {

      uploadedFiles[field] = [];
      for (const file of files[field]) {
  try {
     // Pass adId if uploading advertisement media
          if ((field === "adImage" || field === "adVideo") && req.body.adId) {
            req.params.adId = req.body.adId; // ensure folder uses adId
          }

    const s3Url = await uploadToS3(file, req);
    uploadedFiles[field].push({ url: s3Url, uploadedAt: timestampIST });
  } catch (uploadErr) {
    console.warn(`Failed to upload ${file.originalname}: ${uploadErr.message}`);
  }
}
    }


    res.json({
      success: true,
      message: "✅ Files uploaded successfully",
      files: uploadedFiles,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
  

});

export default router;