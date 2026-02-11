import express from "express";
import upload, { uploadToS3 } from "../middlewares/upload.js";
import moment from "moment-timezone";

const router = express.Router();

const mediaFields = upload.fields([
  { name: "profileImage", maxCount: 1 },
  { name: "coverImage", maxCount: 1 },
  { name: "certificateImages", maxCount: 5 },
  { name: "galleryImages", maxCount: 100 },
  { name: "eventsImage", maxCount: 1 },
  { name: "aadhaarFront", maxCount: 1 },
  { name: "aadhaarBack", maxCount: 1 },
  { name: "driverPhoto", maxCount: 1 },
  { name: "licenseCopy", maxCount: 1 },
  { name: "others", maxCount: 5 },
  { name: "rewardImage", maxCount: 1 },
  { name: "ryngales-profile", maxCount: 1 },
  { name: "attachments", maxCount: 30 },

  // Advertisement
  { name: "adImage", maxCount: 5 },
  { name: "adVideo", maxCount: 1 },

  { name: "qrCode", maxCount: 1 },
]);

// ✅ Multer wrapper (same, but clean exit)
const handleUpload = (req, res, next) => {
  mediaFields(req, res, function (err) {
    if (!err) return next();

    // 🧠 Known fields maxCount mapping
    const fieldLimits = {
      profileImage: 1,
      coverImage: 1,
      certificateImages: 5,
      galleryImages: 100,
      eventsImage: 1,
      aadhaarFront: 1,
      aadhaarBack: 1,
      driverPhoto: 1,
      licenseCopy: 1,
      others: 5,
      rewardImage: 1,
      "ryngales-profile": 1,
      "ryngales-store": 1,
      adImage: 5,
      adVideo: 1,
      qrCode: 1,
    };

    // ❌ File size exceeded
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.json({
        success: false,
        message: "File size too large",
      });
    }

    // ❌ Too many files for a known field
    if (err.code === "LIMIT_UNEXPECTED_FILE" && fieldLimits[err.field]) {
      return res.json({
        success: false,
        message: `You can upload maximum ${fieldLimits[err.field]} images in one time.`,
      });
    }

    // ❌ Truly unknown field
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.json({
        success: false,
        message: `Unexpected file field: ${err.field}`,
      });
    }

    return res.json({
      success: false,
      message: "Upload error",
    });
  });
};


router.post("/upload", handleUpload, async (req, res) => {
  const files = req.files || {};

  // 🆕 No files safety
  if (Object.keys(files).length === 0) {
    return res.json({
      success: false,
      message: "No files received",
    });
  }

  const uploadedFiles = {};
  const failedFiles = []; // 🆕 Vibechat-style partial failure

  const timestampIST = moment()
    .tz("Asia/Kolkata")
    .format("YYYY-MM-DD HH:mm:ss");

  for (const field in files) {
    uploadedFiles[field] = [];

    for (const file of files[field]) {
      // 🆕 Advertisement folder support
      if ((field === "adImage" || field === "adVideo") && req.body.adId) {
        req.params.adId = req.body.adId;
      }

      const result = await uploadToS3(file, req);

      if (result.success) {
        uploadedFiles[field].push({
          url: result.url,
          uploadedAt: timestampIST,
        });
      } else {
        // 🆕 silently collect failed ones
        failedFiles.push({
          field,
          fileName: file.originalname,
          reason: result.message,
        });
      }
    }
  }

  return res.json({
    success: true,
    message: "Upload completed",
    files: uploadedFiles,
    failed: failedFiles, // 🆕 client can ignore or show
  });
});

export default router;
