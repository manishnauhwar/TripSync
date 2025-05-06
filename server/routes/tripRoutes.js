import express from 'express';
import { createTrip, getUserTrips, getTrip, inviteToTrip, updateParticipantRole, acceptInvitation } from '../controllers/tripController.js';
import { getExpenses, addExpense, exportExpensesPdf } from '../controllers/expenseController.js';
import { authenticateUser, optionalAuthUser } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateUser);

router.post('/', createTrip);
router.get('/', getUserTrips);
router.get('/:id', getTrip);
router.post('/:id/invite', inviteToTrip);
router.patch('/:id/participant-role', updateParticipantRole);

router.post('/:id/accept-invitation', optionalAuthUser, acceptInvitation);

// Expense Routes
router.get('/:id/expenses', getExpenses);
router.post('/:id/expenses', addExpense);
router.get('/:id/expenses/export-pdf', exportExpensesPdf);

export default router; 