import express from 'express';
import { createTrip, getUserTrips, getTrip, inviteToTrip, updateParticipantRole, acceptInvitation } from '../controllers/tripController.js';
import { authenticateUser, optionalAuthUser } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateUser);

router.post('/', createTrip);
router.get('/', getUserTrips);
router.get('/:id', getTrip);
router.post('/:id/invite', inviteToTrip);
router.patch('/:id/participant-role', updateParticipantRole);

router.post('/:id/accept-invitation', optionalAuthUser, acceptInvitation);

export default router; 