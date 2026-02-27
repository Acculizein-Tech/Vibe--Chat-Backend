import crypto from "crypto";
import User from "../models/user.js";
import UserContact from "../models/UserContact.js";
import mongoose from "mongoose";

const normalizePhone = (phone) => String(phone || "").replace(/\D/g, "").slice(-10);
const hashPhone = (phone) => crypto.createHash("sha256").update(phone).digest("hex");

const emitContactsChanged = (req, ownerId, payload = {}) => {
  try {
    const io = req.app.get("io");
    const uid = String(ownerId || "");
    if (!io || !uid) return;
    io.to(`user:${uid}`).emit("contacts:changed", {
      ownerId: uid,
      updatedAt: new Date().toISOString(),
      ...payload,
    });
  } catch (err) {
    console.error("contacts:changed emit failed:", err);
  }
};

export const syncContacts = async (req, res) => {
  const userId = req.user._id;
  const contacts = Array.isArray(req.body?.contacts) ? req.body.contacts : [];
  const bulkOps = [];

  for (const c of contacts) {
    const normalized = normalizePhone(c?.phone);
    if (!normalized) continue;

    const phoneHash = hashPhone(normalized);
    const matchedUser = await User.findOne({ phoneHash });

    bulkOps.push({
      updateOne: {
        filter: { owner: userId, phoneHash },
        update: {
          $set: {
            contactName: c?.name || "",
            phone: normalized,
            phoneHash,
            linkedUser: matchedUser?._id || null,
            isOnPlatform: !!matchedUser,
          },
        },
        upsert: true,
      },
    });
  }

  if (bulkOps.length) {
    await UserContact.bulkWrite(bulkOps);
  }

  emitContactsChanged(req, userId, { action: "sync" });
  res.json({ success: true });
};

export const saveChatContact = async (req, res) => {
  const ownerId = req.user._id;
  const { senderUserId, firstName, lastName } = req.body || {};

  const sender = await User.findById(senderUserId).select("phone phoneHash");
  if (!sender || !sender.phone) {
    return res.status(400).json({ message: "Invalid sender" });
  }

  const normalizedPhone = normalizePhone(sender.phone);
  const phoneHash = sender.phoneHash || hashPhone(normalizedPhone);

  const contact = await UserContact.findOneAndUpdate(
    { owner: ownerId, phoneHash },
    {
      $set: {
        firstName,
        lastName,
        phone: normalizedPhone,
        phoneHash,
        linkedUser: sender._id,
        isOnPlatform: true,
      },
    },
    { upsert: true, new: true },
  );

  emitContactsChanged(req, ownerId, {
    action: "save",
    linkedUserId: String(sender._id || ""),
  });

  res.json({ success: true, contact });
};

export const editContact = async (req, res) => {
  try {
    const { contactId } = req.params;
    const { firstName, lastName } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(contactId)) {
      return res.status(400).json({ message: "Invalid contact id" });
    }

    const contact = await UserContact.findById(contactId);
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }

    contact.firstName = firstName;
    contact.lastName = lastName;
    await contact.save();

    emitContactsChanged(req, contact.owner, {
      action: "edit",
      linkedUserId: String(contact.linkedUser || ""),
    });

    res.json({ success: true, contact });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteContact = async (req, res) => {
  const { contactId } = req.params;

  const contact = await UserContact.findByIdAndDelete(contactId);
  if (!contact) {
    return res.status(404).json({ message: "Contact not found" });
  }

  emitContactsChanged(req, contact.owner, {
    action: "delete",
    linkedUserId: String(contact.linkedUser || ""),
  });

  res.json({ success: true, message: "Contact Deleted Successfully" });
};
