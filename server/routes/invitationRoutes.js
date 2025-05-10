import express from 'express';
import invitationController from '../controllers/invitationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/generate', protect, invitationController.generateInviteLink);
router.post('/accept/:tripId/:email', protect, invitationController.acceptInvitation);

export default router; // ✅ ESM export
