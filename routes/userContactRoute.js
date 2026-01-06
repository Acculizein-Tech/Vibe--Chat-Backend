import express from "express";
import { syncContacts, saveChatContact, editContact, deleteContact } from "../controllers/userContact.js";
import { protect } from '../middlewares/auth.js';
import role from '../middlewares/roles.js';
const router = express.Router();
‌
router.post("/", protect, role('customer'), syncContacts);
router.post("/save-contact", protect, saveChatContact);
router.put('/edit-contact/:contactId', protect, role('customer'), editContact);
router.delete('/delete-contact/:contactId', protect, role('customer'), deleteContact);
‌
export default router;