import express from "express";
import multer from "multer";
import upload, { uploadToS3 } from "../middlewares/upload.js";

import {
  createAd,
  getUserAds,
  approveAd,
  trackAdEvent,
  pauseAd,
} from "../controllers/advertisementController.js";
import { protect } from '../middlewares/auth.js';
import  role  from '../middlewares/roles.js';

const router = express.Router();

// Multer for ad uploads
const adMedia = upload.fields([
  { name: "adImage", maxCount: 5 }, // ✅ max 5 images
  { name: "adVideo", maxCount: 1 }, // ✅ max 1 video
]);

// Wrapper for multer error handling
// Wrapper for multer error handling
const handleUpload = (req, res, next) => {
  adMedia(req, res, function (err) {
    if (err) {
      let message = "❌ Something went wrong with the file upload.";

      // Customize messages
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        message =
          err.field === "adImage"
            ? "❌ You can upload a maximum of 5 advertisement images."
            : err.field === "adVideo"
            ? "❌ You can upload only 1 advertisement video."
            : `❌ Unexpected file field: ${err.field}`;
      } else if (err.code === "LIMIT_FILE_SIZE") {
        message = "❌ One or more files are too large. Please check the size limit.";
      } else if (err.code === "LIMIT_PART_COUNT") {
        message = "❌ Too many parts in the request.";
      }

      return res.status(400).json({
        success: false,
        message,
      });
    }
    next();
  });
};


// User routes
router.post("/", protect, handleUpload, createAd); // ✅ handle file uploads here
router.get("/", protect, getUserAds);
router.post("/track", trackAdEvent);
router.patch("/:adId/pause", protect, pauseAd);

// Admin routes
router.patch("/:adId/approve", protect, role("admin"), approveAd);

export default router;
