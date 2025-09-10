import express from "express";
import {
  createAdvertisement,
  getAdvertisements,
  updateAdvertisement,
  deleteAdvertisement,
} from "../controllers/advertisementController.js";
import upload from "../middlewares/upload.js"; // ✅ tumhara S3 middleware
import roles from "../middlewares/roles.js";
import { protect } from "../middlewares/auth.js";


const router = express.Router();

// upload.fields → alag-alag fields ke liye
router.post(
  "/",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  createAdvertisement
);

router.get("/", getAdvertisements);
router.put(
  "/:id",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  updateAdvertisement
);
router.delete("/:id", deleteAdvertisement);

export default router;
