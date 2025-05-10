import express from 'express';
import { 
  getMessages,
  sendMessage,
  markMessagesAsRead,
  uploadFile,
  deleteMessage
} from '../controllers/chatController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('Created uploads directory at:', uploadDir);
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('Saving file to:', uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with timestamp and original extension
    const fileExt = path.extname(file.originalname);
    const fileName = path.basename(file.originalname, fileExt);
    const uniqueFilename = `${fileName}-${Date.now()}${fileExt}`;
    console.log('Generated filename:', uniqueFilename);
    cb(null, uniqueFilename);
  }
});

// File filter to validate file types
const fileFilter = (req, file, cb) => {
  console.log('Received file:', file.originalname, 'type:', file.mimetype);
  
  // Accept images and documents
  const allowedMimes = [
    'image/jpeg', 'image/png', 'image/gif',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // Accept anyway but log warning
    console.log('Warning: File type not in allowed list:', file.mimetype);
    cb(null, true);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file size limit
  } 
});

const router = express.Router();

// Serve static files from the uploads directory WITHOUT authentication
// This must be placed BEFORE the authentication middleware
router.use('/uploads', express.static(path.join(__dirname, '../uploads')));
console.log('Static files served from:', '/api/chat/uploads', 'without authentication');

// Apply authentication middleware to protected routes
router.use(authenticateUser);

// Message routes
router.get('/messages/:tripId', getMessages);
router.post('/messages/:tripId', sendMessage);
router.put('/messages/:tripId/read', markMessagesAsRead);
router.delete('/messages/:tripId/:messageId', deleteMessage);

// File upload route
router.post('/upload', upload.single('file'), uploadFile);

// Log setup information
console.log('Chat routes initialized');
console.log('Upload directory:', uploadDir);

export default router; 