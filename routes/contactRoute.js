import express from "express";
import User from "../models/user.js";

const router = express.Router();

router.post("/sync", async (req, res) => {
  try {
    const { contacts } = req.body;

    // Extract all phone numbers
    const phoneNumbers = contacts.map(c => c.phone.replace(/\s+/g, ""));

    // Find users whose phone number matches
    const matchedUsers = await User.find({
      phone: { $in: phoneNumbers },
    }).select("_id name phone email");

    res.json({ matchedUsers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
