import Message from '../models/messageModel.js';
import Trip from '../models/tripModel.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendChatNotification } from './notificationController.js';
import { v2 as cloudinary } from 'cloudinary';

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
      'participants.user': userId,
      'participants.status': 'accepted'
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found or you do not have access'
      });
    }

    // Filter out messages that are:
    // 1. Marked as globally deleted
    // 2. Or individually deleted for this user
    const messages = await Message.find({
      trip: tripId,
      deleted: { $ne: true },
      deletedFor: { $ne: userId }
    })
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

    // Send push notification to other participants
    if (type === 'text') {
      // Only send notifications for text messages
      await sendChatNotification(tripId, userId, content);
    } else if (type === 'image') {
      // For image messages, send a generic notification
      await sendChatNotification(tripId, userId, 'Sent an image');
    } else if (type === 'location') {
      // For location messages, send a generic notification
      await sendChatNotification(tripId, userId, 'Shared a location');
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
      'participants.user': userId,
      'participants.status': 'accepted'
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

export const deleteMessage = async (req, res) => {
  try {
    const { tripId, messageId } = req.params;
    const userId = req.user._id;
    const { deleteForEveryone } = req.body;

    // Verify trip access
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

    // Find the message
    const message = await Message.findOne({
      _id: messageId,
      trip: tripId
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is allowed to delete for everyone
    const canDeleteForEveryone = message.sender.toString() === userId.toString();
    
    if (deleteForEveryone && !canDeleteForEveryone) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete your own messages for everyone'
      });
    }

    // Handle media deletion if deleting for everyone
    if (deleteForEveryone && message.type === 'image' && message.mediaUrl) {
      try {
        // Check if the mediaUrl is from Cloudinary
        if (message.mediaUrl.includes('cloudinary.com')) {
          // Extract the public_id from the URL
          // The URL format is usually: https://res.cloudinary.com/cloud_name/image/upload/v123456/folder/public_id.ext
          let publicId = '';
          
          if (message.mediaUrl.includes('/image/upload/')) {
            // Standard image URL
            const uploadPos = message.mediaUrl.indexOf('/image/upload/');
            const afterUploadPart = message.mediaUrl.substring(uploadPos + '/image/upload/'.length);
            
            // Handle version number if present (v1234567/)
            let relevantPath = afterUploadPart;
            if (afterUploadPart.match(/^v\d+\//)) {
              relevantPath = afterUploadPart.substring(afterUploadPart.indexOf('/') + 1);
            }
            
            // Remove file extension if present
            publicId = relevantPath.includes('.') 
              ? relevantPath.substring(0, relevantPath.lastIndexOf('.'))
              : relevantPath;
          } else {
            // Fallback to simple extraction
            const urlParts = message.mediaUrl.split('/');
            const filenameWithExtension = urlParts[urlParts.length - 1];
            publicId = filenameWithExtension.includes('.')
              ? filenameWithExtension.substring(0, filenameWithExtension.lastIndexOf('.'))
              : filenameWithExtension;
          }
          
          if (publicId) {
            // Delete the image from Cloudinary
            console.log(`Attempting to delete image with public ID: ${publicId}`);
            await cloudinary.uploader.destroy(publicId);
            console.log(`Successfully deleted image from Cloudinary: ${publicId}`);
          } else {
            console.warn('Could not extract public ID from URL:', message.mediaUrl);
          }
        } else if (message.mediaUrl.includes('/uploads/')) {
          // For locally stored files
          try {
            const filename = message.mediaUrl.split('/uploads/').pop();
            const filepath = path.join(uploadDir, filename);
            
            if (fs.existsSync(filepath)) {
              fs.unlinkSync(filepath);
              console.log(`Successfully deleted local file: ${filepath}`);
            }
          } catch (fileErr) {
            console.error('Error deleting local file:', fileErr);
            // Continue with message deletion even if file deletion fails
          }
        }
      } catch (cloudinaryErr) {
        console.error('Error deleting image from Cloudinary:', cloudinaryErr);
        // Continue with message deletion even if Cloudinary deletion fails
      }
    }

    // Perform the deletion based on deleteForEveryone flag
    if (deleteForEveryone) {
      // Mark the message as deleted (soft delete)
      await Message.findByIdAndUpdate(messageId, { deleted: true });
      
      // Emit real-time notification to all trip participants
      if (req.io) {
        req.io.to(`trip-${tripId}`).emit('message-deleted', {
          messageId,
          deleteForEveryone: true
        });
      }
    } else {
      // For delete for me, add user to deletedFor array
      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { deletedFor: userId }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
      deleteForEveryone
    });
  } catch (error) {
    console.error('Error deleting message:', error);
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