import express from "express";
import User from "../models/user.js";

const router = express.Router();

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

router.post("/sync", async (req, res) => {
  try {
    const { contacts } = req.body;

    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ message: "Contacts must be an array" });
    }

    const phoneNumbers = contacts
      .map(c => c.phone?.replace(/\s+/g, "").replace(/^(\+91|91)/, "")) // normalize Indian numbers
      .filter(Boolean);

    const matchedUsers = await User.find({
      phone: { $in: phoneNumbers },
    }).select("_id fullName phone email profile.avatar");

    res.status(200).json({
      matchedUsers,
      unmatchedContacts: contacts.filter(
        c => !matchedUsers.find(u => u.phone === c.phone.replace(/^(\+91|91)/, ""))
      ),
    });
  } catch (error) {
    console.error("Error syncing contacts:", error);
    res.status(500).json({ message: "Server error" });
  }
});


export default router;
