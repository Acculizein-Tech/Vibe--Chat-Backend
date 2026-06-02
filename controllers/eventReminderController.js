import EventReminder from "../models/EventReminder.js";
import fetch from "node-fetch";
import { uploadToS3 } from "../middlewares/upload.js";

const toSafe = (v) => String(v || "").trim();
const parseDateOnly = (raw) => {
  const text = toSafe(raw);
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, mo, d };
};
const parseTimeToMinutes = (raw) => {
  const text = toSafe(raw).toUpperCase();
  const m = text.match(/^(\d{1,2})\s*:\s*(\d{2})\s*(AM|PM)$/);
  if (!m) return null;
  let hh = Number(m[1]);
  const mm = Number(m[2]);
  const ap = m[3];
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 1 || hh > 12 || mm < 0 || mm > 59) return null;
  if (ap === "AM") hh = hh === 12 ? 0 : hh;
  if (ap === "PM") hh = hh === 12 ? 12 : hh + 12;
  return hh * 60 + mm;
};
const buildEventDateTime = (dateRaw, timeRaw) => {
  const dateParts = parseDateOnly(dateRaw);
  const totalMins = parseTimeToMinutes(timeRaw);
  if (!dateParts || totalMins === null) return null;
  const hours = Math.floor(totalMins / 60);
  const minutes = totalMins % 60;
  return new Date(dateParts.y, dateParts.mo - 1, dateParts.d, hours, minutes, 0, 0);
};
const emitEventChange = (req, userId, action, eventDoc) => {
  try {
    const io = req?.app?.get?.("io");
    if (!io || !userId) return;
    io.to(`user:${String(userId)}`).emit("events:changed", {
      action: String(action || "updated"),
      event: eventDoc || null,
      at: new Date().toISOString(),
    });
  } catch (_err) {
    // no-op
  }
};

export const createEventReminder = async (req, res) => {
  try {
    const userId = String(req.user?._id || req.user?.id || "").trim();
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const payload = req.body || {};
    const date = toSafe(payload.date);
    const name = toSafe(payload.name);
    const startTime = toSafe(payload.startTime);
    const endTime = toSafe(payload.endTime);
    if (!date || !name || !endTime) {
      return res.status(400).json({ message: "date, name and endTime are required" });
    }
    const endAt = buildEventDateTime(date, endTime);
    if (!endAt || Number.isNaN(endAt.getTime())) {
      return res.status(400).json({ message: "Invalid event date/endTime format" });
    }

    let eventImage = "";
    if (req.file) {
      const uploaded = await uploadToS3(req.file, req);
      if (!uploaded?.success || !uploaded?.url) {
        return res.status(400).json({ message: uploaded?.message || "Event image upload failed" });
      }
      eventImage = String(uploaded.url || "").trim();
    }

    const doc = await EventReminder.create({
      userId,
      date,
      name,
      eventType: toSafe(payload.eventType) || "Work",
      customEventType: toSafe(payload.customEventType),
      description: toSafe(payload.description),
      startTime,
      endTime,
      endAt,
      location: toSafe(payload.location),
      eventImage,
      reminderValue: Number(payload.reminderValue || 30),
      reminderUnit: toSafe(payload.reminderUnit) === "hours" ? "hours" : "minutes",
      reminderNotifiedAt: null,
      startNotifiedAt: null,
      endNotifiedAt: null,
    });
    emitEventChange(req, userId, "created", doc);
    return res.status(201).json({ event: doc });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const listEventReminders = async (req, res) => {
  try {
    const userId = String(req.user?._id || req.user?.id || "").trim();
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const includeAll = String(req.query?.includeAll || "").trim() === "1";
    const onlyStatus = String(req.query?.status || "").trim().toLowerCase();
    const now = new Date();
    const rows = await EventReminder.find({
      userId,
      ...(includeAll
        ? {}
        : {
            dismissedAt: null,
            $or: [{ endAt: { $gt: now } }, { endAt: { $exists: false } }, { endAt: null }],
          }),
    })
      .sort({ createdAt: -1 })
      .lean();

    const rowsWithStatus = rows.map((row) => {
      const fallbackEndAt = buildEventDateTime(row?.date, row?.endTime);
      const endAtMs = row?.endAt
        ? new Date(row.endAt).getTime()
        : fallbackEndAt
          ? fallbackEndAt.getTime()
          : NaN;
      const isDismissed = Boolean(row?.dismissedAt);
      const isExpired = Number.isFinite(endAtMs) ? endAtMs <= now.getTime() : true;
      const status = isDismissed ? "dismissed" : isExpired ? "inactive" : "active";
      return { ...row, status };
    });

    const filteredRows = onlyStatus
      ? rowsWithStatus.filter((row) => row.status === onlyStatus)
      : rowsWithStatus;

    return res.status(200).json({ events: filteredRows });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const updateEventReminder = async (req, res) => {
  try {
    const userId = String(req.user?._id || req.user?.id || "").trim();
    const id = toSafe(req.params?.id);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!id) return res.status(400).json({ message: "id is required" });

    const payload = req.body || {};
    const date = toSafe(payload.date);
    const name = toSafe(payload.name);
    const startTime = toSafe(payload.startTime);
    const endTime = toSafe(payload.endTime);
    if (!date || !name || !endTime) {
      return res.status(400).json({ message: "date, name and endTime are required" });
    }
    const endAt = buildEventDateTime(date, endTime);
    if (!endAt || Number.isNaN(endAt.getTime())) {
      return res.status(400).json({ message: "Invalid event date/endTime format" });
    }

    let eventImage = toSafe(payload.eventImage);
    if (req.file) {
      const uploaded = await uploadToS3(req.file, req);
      if (!uploaded?.success || !uploaded?.url) {
        return res.status(400).json({ message: uploaded?.message || "Event image upload failed" });
      }
      eventImage = String(uploaded.url || "").trim();
    }
    const hasEventImageField = Object.prototype.hasOwnProperty.call(payload, "eventImage");

    const updated = await EventReminder.findOneAndUpdate(
      { _id: id, userId },
      {
        $set: {
          date,
          name,
          eventType: toSafe(payload.eventType) || "Work",
          customEventType: toSafe(payload.customEventType),
          description: toSafe(payload.description),
          startTime,
          endTime,
          endAt,
          location: toSafe(payload.location),
          ...(req.file || hasEventImageField ? { eventImage } : {}),
          reminderValue: Number(payload.reminderValue || 30),
          reminderUnit: toSafe(payload.reminderUnit) === "hours" ? "hours" : "minutes",
          reminderNotifiedAt: null,
          startNotifiedAt: null,
          endNotifiedAt: null,
          dismissedAt: null,
        },
      },
      { new: true },
    ).lean();
    if (!updated) return res.status(404).json({ message: "Event not found" });
    emitEventChange(req, userId, "updated", updated);
    return res.status(200).json({ event: updated });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const dismissEventReminder = async (req, res) => {
  try {
    const userId = String(req.user?._id || req.user?.id || "").trim();
    const id = toSafe(req.params?.id);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!id) return res.status(400).json({ message: "id is required" });

    const updated = await EventReminder.findOneAndUpdate(
      { _id: id, userId },
      { $set: { dismissedAt: new Date() } },
      { new: true },
    ).lean();
    if (!updated) return res.status(404).json({ message: "Event not found" });
    emitEventChange(req, userId, "dismissed", updated);
    return res.status(200).json({ event: updated });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const deleteEventReminder = async (req, res) => {
  try {
    const userId = String(req.user?._id || req.user?.id || "").trim();
    const id = toSafe(req.params?.id);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!id) return res.status(400).json({ message: "id is required" });

    const deleted = await EventReminder.findOneAndDelete({ _id: id, userId }).lean();
    if (!deleted) return res.status(404).json({ message: "Event not found" });
    emitEventChange(req, userId, "deleted", { _id: id });
    return res.status(200).json({ success: true, id });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getLocationSuggestions = async (req, res) => {
  try {
    const userId = String(req.user?._id || req.user?.id || "").trim();
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const q = toSafe(req.query?.q);
    const lat = Number(req.query?.lat);
    const lon = Number(req.query?.lon);
    const limit = Math.max(1, Math.min(10, Number(req.query?.limit) || 8));
    if (!q || q.length < 2) {
      return res.status(400).json({ message: "Query must be at least 2 characters." });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || "";
    if (!apiKey) {
      return res.status(500).json({ message: "Google Places API key is not configured." });
    }

    const biasParams =
      Number.isFinite(lat) && Number.isFinite(lon)
        ? `&location=${lat},${lon}&radius=50000`
        : "";
    const autoUrl =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}` +
      `&language=en&types=geocode&key=${encodeURIComponent(apiKey)}${biasParams}`;

    const autoRes = await fetch(autoUrl);
    if (!autoRes.ok) {
      return res.status(502).json({ message: "Failed to fetch Google autocomplete suggestions." });
    }
    const autoData = await autoRes.json();
    const predictions = Array.isArray(autoData?.predictions) ? autoData.predictions.slice(0, limit) : [];

    const details = await Promise.all(
      predictions.map(async (pred) => {
        const placeId = toSafe(pred?.place_id);
        if (!placeId) return null;
        const detailsUrl =
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}` +
          `&fields=geometry/location,name,formatted_address&key=${encodeURIComponent(apiKey)}`;
        try {
          const detailsRes = await fetch(detailsUrl);
          if (!detailsRes.ok) return null;
          const detailsData = await detailsRes.json();
          const loc = detailsData?.result?.geometry?.location;
          const latitude = Number(loc?.lat);
          const longitude = Number(loc?.lng);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
          const title = toSafe(pred?.structured_formatting?.main_text) || toSafe(detailsData?.result?.name);
          const subtitle =
            toSafe(pred?.structured_formatting?.secondary_text) ||
            toSafe(detailsData?.result?.formatted_address);
          return {
            placeId,
            title: title || "Selected place",
            subtitle,
            latitude,
            longitude,
          };
        } catch {
          return null;
        }
      }),
    );

    const suggestions = details.filter(Boolean);
    return res.status(200).json({ suggestions });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

export const getReverseGeocode = async (req, res) => {
  try {
    const userId = String(req.user?._id || req.user?.id || "").trim();
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const lat = Number(req.query?.lat);
    const lon = Number(req.query?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ message: "Valid lat/lon are required." });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || "";
    if (!apiKey) {
      return res.status(500).json({ message: "Google Maps API key is not configured." });
    }

    const geoUrl =
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(`${lat},${lon}`)}` +
      `&language=en&key=${encodeURIComponent(apiKey)}`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) {
      return res.status(502).json({ message: "Failed to fetch reverse geocode." });
    }
    const geoData = await geoRes.json();
    const first = Array.isArray(geoData?.results) ? geoData.results[0] : null;
    const components = Array.isArray(first?.address_components)
      ? first.address_components
      : [];
    const pick = (types = []) =>
      components.find((c) => Array.isArray(c?.types) && types.some((t) => c.types.includes(t)))?.long_name || "";

    const locality =
      pick(["sublocality_level_1", "sublocality", "neighborhood"]) ||
      pick(["locality"]) ||
      pick(["administrative_area_level_2"]);
    const city = pick(["locality"]) || pick(["administrative_area_level_2"]);
    const state = pick(["administrative_area_level_1"]);
    const country = pick(["country"]);
    const label = [locality, city, state, country]
      .map((v) => String(v || "").trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(", ");

    return res.status(200).json({
      label: label || String(first?.formatted_address || "").trim(),
      formattedAddress: String(first?.formatted_address || "").trim(),
      placeId: String(first?.place_id || ""),
    });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
