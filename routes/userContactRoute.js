import express from "express";
import { syncContacts, saveChatContact } from "../controllers/userContact.js";
import { protect } from '../middlewares/auth.js';
import role from '../middlewares/roles.js';
const router = express.Router();

router.post("/", protect, role('customer'), syncContacts);
router.post("/save-contact", protect, saveChatContact);

export default router;