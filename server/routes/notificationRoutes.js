import express from 'express';
import { 
  registerDevice, 
  updateDeviceActivity
} from '../controllers/notificationController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticateUser);

router.post('/register-device', registerDevice);

router.post('/update-activity', updateDeviceActivity);

export default router; 