import express from "express";
import { protect } from "../middlewares/auth.js";
import { csvUpload } from "../middlewares/csvUpload.js";
import { createSimpleRateLimiter } from "../middlewares/simpleRateLimiter.js";
import {
  uploadCsv,
  sendBulk,
  getBulkStatus,
  exportBulkReport,
  getBulkPlanInfo,
} from "../controllers/bulkMessagingController.js";

const router = express.Router();

const uploadRateLimiter = createSimpleRateLimiter({
  keyPrefix: "bulk:upload",
  windowMs: 60_000,
  maxRequests: 10,
});

const sendRateLimiter = createSimpleRateLimiter({
  keyPrefix: "bulk:send",
  windowMs: 60_000,
  maxRequests: 8,
});

const statusRateLimiter = createSimpleRateLimiter({
  keyPrefix: "bulk:status",
  windowMs: 15_000,
  maxRequests: 20,
});

router.get("/bulk-plan", protect, getBulkPlanInfo);

router.post(
  "/upload-csv",
  protect,
  uploadRateLimiter,
  (req, res, next) => {
    csvUpload.single("file")(req, res, (err) => {
      if (!err) return next();

      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "CSV file size must be 5MB or less" });
      }

      return res.status(400).json({ message: err.message || "CSV upload failed" });
    });
  },
  uploadCsv,
);

router.post("/send-bulk", protect, sendRateLimiter, sendBulk);
router.get("/bulk-status/:id", protect, statusRateLimiter, getBulkStatus);
router.get("/bulk-report/:id", protect, statusRateLimiter, exportBulkReport);

export default router;
