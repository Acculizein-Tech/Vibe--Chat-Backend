import express from "express";
import crypto from "crypto";
import User from "../models/user.js";
import UserContact from "../models/UserContact.js";
import { protect } from "../middlewares/auth.js";
import role from "../middlewares/roles.js";

const router = express.Router();
const normalizePhone = (phone = "") =>
  String(phone || "").replace(/\D/g, "").slice(-10);
const hashPhone = (phone) =>
  crypto.createHash("sha256").update(String(phone || "")).digest("hex");
const escapeRegex = (value = "") =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const buildExistingName = (contact) => {
  if (!contact) return "";
  const first = String(contact?.firstName || "").trim();
  const last = String(contact?.lastName || "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;
  return String(contact?.contactName || "").trim();
};

// router.post("/sync", async (req, res) => {
//   try {
//     const { contacts } = req.body;

//     // Extract all phone numbers
//     const phoneNumbers = contacts.map(c => c.phone.replace(/\s+/g, ""));

//     // Find users whose phone number matches
//     const matchedUsers = await User.find({
//       phone: { $in: phoneNumbers },
//     }).select("_id name phone email");

//     res.json({ matchedUsers });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

router.post("/sync", protect, role("customer"), async (req, res) => {
  try {
    const { contacts } = req.body;

    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ message: "Contacts must be an array" });
    }

    const normalizedContacts = contacts
      .map((c) => {
        const normalizedPhone = normalizePhone(c?.phone);
        const name = String(c?.name || "").trim();
        if (!normalizedPhone) return null;
        return { name, phone: normalizedPhone, phoneHash: hashPhone(normalizedPhone) };
      })
      .filter(Boolean);
    const phoneHashes = normalizedContacts.map((c) => c.phoneHash);

    const normalizedPhones = normalizedContacts.map((c) => c.phone);
    const phoneSuffixPatterns = normalizedPhones.map(
      (p) => new RegExp(`${escapeRegex(p)}$`),
    );
    const matchedUsers = await User.find({
      $or: [
        { phoneHash: { $in: phoneHashes } },
        { phone: { $in: normalizedPhones } },
        { phone: { $in: phoneSuffixPatterns } },
      ],
    }).select("_id fullName phone email profile.avatar phoneHash");
    const matchedByPhoneHash = new Map(
      matchedUsers.map((u) => [hashPhone(normalizePhone(u?.phone)), u]),
    );

    const ownerId = req.user?._id;
    const ownerContacts = ownerId
      ? await UserContact.find({
          owner: ownerId,
          phoneHash: { $in: phoneHashes },
        }).select("phoneHash firstName lastName contactName linkedUser")
      : [];
    const ownerContactByHash = new Map(
      ownerContacts.map((c) => [String(c?.phoneHash || ""), c]),
    );

    const hydratedMatchedUsers = [];
    normalizedContacts.forEach((c) => {
      const user = matchedByPhoneHash.get(c.phoneHash);
      if (!user) return;
      const contact = ownerContactByHash.get(c.phoneHash) || null;
      const existingName =
        buildExistingName(contact) ||
        String(c?.name || "").trim() ||
        String(user?.fullName || "").trim() ||
        "";
      hydratedMatchedUsers.push({
        _id: user._id,
        fullName: user.fullName || "",
        phone: normalizePhone(user.phone),
        email: user.email || "",
        profile: user.profile || {},
        existingName,
        existingUserId: contact?._id || null,
      });
    });

    res.status(200).json({
      matchedUsers: hydratedMatchedUsers,
      unmatchedContacts: normalizedContacts.filter(
        (c) => !matchedByPhoneHash.has(c.phoneHash),
      ),
    });
  } catch (error) {
    console.error("Error syncing contacts:", error);
    res.status(500).json({ message: "Server error" });
  }
});


export default router;
