import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { 
  uploadDocument, 
  getTripDocuments, 
  deleteDocument 
} from '../controllers/documentController.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Routes for document management
router.post('/trips/:tripId/documents', uploadDocument);
router.get('/trips/:tripId/documents', getTripDocuments);
router.delete('/trips/:tripId/documents/:documentId', deleteDocument);

export default router;