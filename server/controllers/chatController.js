import Message from '../models/messageModel.js';
import Trip from '../models/tripModel.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const getMessages = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const userId = req.user._id;

    const trip = await Trip.findOne({
      _id: tripId,
      'participants.user': userId
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found or you do not have access'
      });
    }

    const messages = await Message.find({ trip: tripId })
      .sort({ createdAt: 1 })
      .populate('sender', 'username fullName email');

    res.status(200).json({
      success: true,
      data: messages
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const userId = req.user._id;
    const { content, type = 'text', mediaUrl, location } = req.body;

    const trip = await Trip.findOne({
      _id: tripId,
      'participants.user': userId,
      'participants.status': 'accepted' 
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found or you do not have access'
      });
    }

    const message = await Message.create({
      trip: tripId,
      sender: userId,
      content,
      type,
      mediaUrl,
      location,
      readBy: [userId] 
    });

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username fullName email');

    if (req.io) {
      req.io.to(`trip-${tripId}`).emit('new-message', populatedMessage);
    }

    res.status(201).json({
      success: true,
      data: populatedMessage
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const userId = req.user._id;
    const { messageIds } = req.body;

    const trip = await Trip.findOne({
      _id: tripId,
      'participants.user': userId
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found or you do not have access'
      });
    }

    await Message.updateMany(
      { 
        _id: { $in: messageIds },
        trip: tripId,
        readBy: { $ne: userId }
      },
      { $addToSet: { readBy: userId } }
    );

    res.status(200).json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};
export const uploadFile = async (req, res) => {
  try {
    console.log('Upload request received');
    if (!req.file) {
      console.log('Error: No file in upload request');
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    // Log file details
    console.log('File details:', {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      savedAs: req.file.filename
    });
    
    // Create file URLs - both the API path and direct path
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    // API path (through /api/chat/uploads) - may need authentication
    const apiFileUrl = `${baseUrl}/api/chat/uploads/${req.file.filename}`;
    
    // Direct path (through /uploads) - public access without authentication
    const publicFileUrl = `${baseUrl}/uploads/${req.file.filename}`;
    
    console.log('Generated file URLs:', {
      apiPath: apiFileUrl,
      publicPath: publicFileUrl
    });
    
    // Return success response with both URLs
    res.status(200).json({
      success: true,
      fileUrl: publicFileUrl, 
      apiFileUrl: apiFileUrl,  
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'File upload failed'
    });
  }
}; 