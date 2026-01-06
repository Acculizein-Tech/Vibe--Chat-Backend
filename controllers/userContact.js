import crypto from "crypto";
import User from "../models/user.js";
import UserContact from "../models/UserContact.js";
import mongoose from "mongoose";
‌
const normalizePhone = (phone) =>
  phone.replace(/\D/g, "").slice(-10);
‌
const hashPhone = (phone) =>
  crypto.createHash("sha256").update(phone).digest("hex");
‌
export const syncContacts = async (req, res) => {
  const userId = req.user._id;
  const contacts = req.body.contacts;
‌
  const bulkOps = [];
‌
  for (const c of contacts) {
    const normalized = normalizePhone(c.phone);
    const phoneHash = hashPhone(normalized);
‌
    const matchedUser = await User.findOne({ phoneHash });
‌
    bulkOps.push({
      updateOne: {
        filter: { owner: userId, phoneHash },
        update: {
          $set: {
            contactName: c.name,
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
‌
  if (bulkOps.length) {
    await UserContact.bulkWrite(bulkOps);
  }
‌
  res.json({ success: true });
};
‌
export const saveChatContact = async (req, res) => {
  const ownerId = req.user._id;
  const { senderUserId, firstName, lastName } = req.body;
‌
  const sender = await User.findById(senderUserId).select("phone phoneHash");
‌
  if (!sender || !sender.phone) {
    return res.status(400).json({ message: "Invalid sender" });
  }
‌
  const normalizedPhone = normalizePhone(sender.phone);
  const phoneHash = sender.phoneHash || hashPhone(normalizedPhone);
‌
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
    { upsert: true, new: true }
  );
‌
  res.json({ success: true, contact });
};
‌
_//edit contact_


export const editContact = async (req, res) => {
  try {
    const { contactId } = req.params;
    const { firstName, lastName } = req.body;
  console.log(contactId)
    _// ✅ ObjectId validation_
    if (!mongoose.Types.ObjectId.isValid(contactId)) {
      return res.status(400).json({ message: "Invalid contact id" });
    }
‌
    _// ✅ findById (NOT find)_
    const contact = await UserContact.findById(contactId);
‌
    if (!contact) {
      return res.status(404).json({ message: "Contact not found" });
    }
‌
    contact.firstName = firstName;
    contact.lastName = lastName;
‌
    await contact.save();
‌
    res.json({ success: true, contact });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


_//delete contact_
export const deleteContact = async (req, res) => {
  const { contactId } = req.params;
‌
  const contact = await UserContact.findByIdAndDelete(contactId);
  if (!contact) {
    return res.status(404).json({ message: "Contact not found" });
  }
‌
  res.json({ success: true, contact });
};