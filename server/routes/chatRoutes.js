import express from 'express';
import { 
  getMessages,
  sendMessage,
  markMessagesAsRead
} from '../controllers/chatController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateUser);

router.get('/messages/:tripId', getMessages);
router.post('/messages/:tripId', sendMessage);
router.put('/messages/:tripId/read', markMessagesAsRead);

export default router; 