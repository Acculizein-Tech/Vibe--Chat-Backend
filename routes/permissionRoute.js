import express from 'express';
import { createPermission, getAllPermissions } from '../controllers/permissionController.js';

const router = express.Router();

router.post('/', createPermission);
router.get('/', getAllPermissions);

export default router;
