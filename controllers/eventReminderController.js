import EventReminder from "../models/EventReminder.js";
import fetch from "node-fetch";
import { uploadToS3 } from "../middlewares/upload.js";
import sharp from "sharp";
import { readFile } from "fs/promises";

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

const wrapText = (value, maxChars = 36) => {
  const clean = toSafe(value);
  if (!clean) return [];
  const words = clean.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 6);
};

const escapeXml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const buildLocationMapUrl = (location) => {
  const text = toSafe(location);
  if (!text) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
};

const fetchImageBuffer = async (rawUri) => {
  const sourceUri = toSafe(rawUri);
  if (!sourceUri) return null;
  if (/^data:/i.test(sourceUri)) {
    const match = sourceUri.match(/^data:([^;]+);base64,(.+)$/i);
    if (!match) return null;
    return Buffer.from(match[2], "base64");
  }
  if (/^https?:\/\//i.test(sourceUri)) {
    const res = await fetch(sourceUri);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  }
  return null;
};

const buildEventShareCardBuffer = async (eventDoc) => {
  const payload = {
    name: toSafe(eventDoc?.name) || "Event",
    description: toSafe(eventDoc?.description),
    date: toSafe(eventDoc?.date),
    time: [toSafe(eventDoc?.startTime), toSafe(eventDoc?.endTime)].filter(Boolean).join(" - "),
    location: toSafe(eventDoc?.location),
    eventImage: toSafe(eventDoc?.eventImage),
  };

  const logoPath = new URL("../assets/images/sidebar-logo.png", import.meta.url);
  const logoBuffer = await readFile(logoPath);
  const logoSized = await sharp(logoBuffer)
    .resize(56, 56, { fit: "contain" })
    .png()
    .toBuffer();
  const eventImageBuffer = await fetchImageBuffer(payload.eventImage);
  const captionLines = [
    payload.name ? `Event: ${payload.name}` : "",
    payload.date ? `Date: ${payload.date}` : "",
    payload.time ? `Time: ${payload.time}` : "",
    payload.location ? `Location: ${payload.location}` : "",
  ].filter(Boolean);
  const captionWrapped = wrapText(captionLines.join(" • "), 54);
  const heroContent = eventImageBuffer
    ? `<rect x="80" y="80" width="1040" height="420" rx="28" ry="28" fill="#DDE8F2" />`
    : `
        <defs>
          <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FF5B5F" />
            <stop offset="50%" stop-color="#9C4DFF" />
            <stop offset="100%" stop-color="#4A7DFF" />
          </linearGradient>
        </defs>
        <rect x="80" y="80" width="1040" height="420" rx="28" ry="28" fill="url(#heroGrad)" />
        <text x="600" y="240" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="700" fill="#FFFFFF">EVENT</text>
        <text x="600" y="300" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="600" fill="#FFFFFF">${escapeXml(payload.name || "Special Event")}</text>
      `;

  const canvas = sharp({
    create: {
      width: 1200,
      height: 1500,
      channels: 4,
      background: "#EAF4E8",
    },
  });

  const composites = [
    {
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
          <rect x="50" y="60" width="1100" height="1380" rx="42" ry="42" fill="#FFFFFF" />
          ${heroContent}
          <text x="80" y="600" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700" fill="#1B2430">
            ${wrapText(payload.name || "Event", 26).map((line, index) => `<tspan x="80" dy="${index === 0 ? 0 : 46}">${escapeXml(line)}</tspan>`).join("")}
          </text>
          ${payload.date || payload.time ? `<text x="80" y="712" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="600" fill="#526F8A">${escapeXml([payload.date, payload.time].filter(Boolean).join(" • "))}</text>` : ""}
          ${payload.description ? `<text x="80" y="760" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#25364A">${wrapText(payload.description, 48).map((line, index) => `<tspan x="80" dy="${index === 0 ? 0 : 34}">${escapeXml(line)}</tspan>`).join("")}</text>` : ""}
          ${payload.location ? `<text x="80" y="1110" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#4C8DFF">${wrapText(`Location: ${buildLocationMapUrl(payload.location)}`, 52).map((line, index) => `<tspan x="80" dy="${index === 0 ? 0 : 32}">${escapeXml(line)}</tspan>`).join("")}</text>` : ""}
          <rect x="80" y="1160" width="1040" height="168" rx="22" ry="22" fill="#F6FAFF" stroke="#D7E0EA" stroke-width="2" />
          <text x="106" y="1200" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="800" fill="#6B7F95" letter-spacing="1">SHARE PREVIEW</text>
          ${captionWrapped.length ? `<text x="106" y="1232" font-family="Arial, Helvetica, sans-serif" font-size="23" font-weight="700" fill="#223247">${captionWrapped.map((line, index) => `<tspan x="106" dy="${index === 0 ? 0 : 32}">${escapeXml(line)}</tspan>`).join("")}</text>` : ""}
          <circle cx="476" cy="1402" r="24" fill="#FFFFFF" stroke="#D7E0EA" stroke-width="2" />
          <text x="540" y="1410" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#7A8AA0">From Ryngales</text>
        </svg>`,
      ),
      top: 0,
      left: 0,
    },
  ];

  if (logoSized) {
    composites.push({
      input: logoSized,
      top: 1374,
      left: 448,
    });
  }

  if (eventImageBuffer) {
    const hero = await sharp(eventImageBuffer)
      .resize(1040, 420, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    composites.push({
      input: hero,
      top: 80,
      left: 80,
    });
  }

  return canvas.composite(composites).jpeg({ quality: 92 }).toBuffer();
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

export const getEventShareCard = async (req, res) => {
  try {
    const userId = String(req.user?._id || req.user?.id || "").trim();
    const id = toSafe(req.params?.id);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!id) return res.status(400).json({ message: "id is required" });

    const event = await EventReminder.findOne({ _id: id, userId }).lean();
    if (!event) return res.status(404).json({ message: "Event not found" });

    console.log("[EventShareCard] build requested", {
      userId,
      eventId: id,
      hasEventImage: Boolean(toSafe(event?.eventImage)),
      name: toSafe(event?.name),
    });
    const buffer = await buildEventShareCardBuffer(event);
    console.log("[EventShareCard] built", {
      eventId: id,
      bytes: buffer?.length || 0,
    });
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Content-Disposition", `attachment; filename="event-share-${id}.jpg"`);
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("X-Ryngales-Event-Card", "1");
    res.setHeader("Content-Length", String(buffer?.length || 0));
    console.log("[EventShareCard] response ready", {
      eventId: id,
      contentType: "image/jpeg",
      contentLength: buffer?.length || 0,
      hasBuffer: Boolean(buffer?.length),
    });
    return res.status(200).send(buffer);
  } catch (err) {
    console.error("[EventShareCard] failed", err);
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
