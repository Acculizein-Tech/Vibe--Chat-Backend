import express from "express";
import { addUserContacts, saveChatContact } from "../controllers/userContact.js";
import { protect } from '../middlewares/auth.js';
import role from '../middlewares/roles.js';
const router = express.Router();

router.post("/", protect, role('customer'), addUserContacts);
router.post("/save-chat", protect, role('customer'), saveChatContact);

export default router;