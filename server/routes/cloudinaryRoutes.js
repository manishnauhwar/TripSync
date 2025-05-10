import express from 'express';
import { getSignature } from '../controllers/cloudinaryController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware
router.use(protect);

// Route for generating Cloudinary signatures
router.get('/signature', getSignature);

export default router; 