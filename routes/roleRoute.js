import express from 'express';
import { createRole, getAllRoles } from '../controllers/roleController.js';

const router = express.Router();

router.post('/', createRole);
router.get('/', getAllRoles);

export default router;
