import express from "express";
import { protect } from "../middlewares/auth.js";
import upload from "../middlewares/upload.js";
import {
  createEventReminder,
  deleteEventReminder,
  dismissEventReminder,
  getEventShareCard,
  getLocationSuggestions,
  getReverseGeocode,
  listEventReminders,
  updateEventReminder,
} from "../controllers/eventReminderController.js";

const router = express.Router();

router.get("/", protect, listEventReminders);
router.get("/location-suggestions", protect, getLocationSuggestions);
router.get("/reverse-geocode", protect, getReverseGeocode);
router.post("/", protect, upload.single("eventImage"), createEventReminder);
router.patch("/:id", protect, upload.single("eventImage"), updateEventReminder);
router.patch("/:id/dismiss", protect, dismissEventReminder);
router.get("/:id/share-card", protect, getEventShareCard);
router.delete("/:id", protect, deleteEventReminder);

export default router;
