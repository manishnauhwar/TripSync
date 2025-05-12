import Document from '../models/documentModel.js';
import Trip from '../models/tripModel.js';
import { sendDocumentNotification } from './notificationController.js';

// Upload a document to a trip
export const uploadDocument = async (req, res) => {
  try {
    const { tripId } = req.params;
    const { name, url, fileType, size, description } = req.body;
    const userId = req.user._id;

    // Validate input
    if (!name || !url || !fileType) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, url, and fileType'
      });
    }

    // Verify user has permission to upload to this trip
    const trip = await Trip.findOne({
      _id: tripId,
      'participants.user': userId,
      'participants.status': 'accepted'
    });

    if (!trip) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to upload documents to this trip'
      });
    }

    // Check user role permissions
    const participant = trip.participants.find(
      p => p.user && p.user.toString() === userId.toString()
    );
    
    if (participant.role === 'viewer') {
      return res.status(403).json({
        success: false,
        message: 'Viewers cannot upload documents. Ask an admin to change your role.'
      });
    }

    // Create and save the document
    const document = await Document.create({
      tripId,
      name,
      url,
      fileType,
      size,
      description,
      uploadedBy: userId
    });

    // Populate the user information
    const populatedDoc = await Document.findById(document._id)
      .populate('uploadedBy', 'username fullName email');

    // Send notification about the new document
    await sendDocumentNotification(tripId, userId, 'uploaded', name);

    // Emit socket event to trip participants
    if (req.io) {
      req.io.to(`trip-${tripId}`).emit('new-document', populatedDoc);
    }

    res.status(201).json({
      success: true,
      data: populatedDoc,
      message: 'Document uploaded successfully'
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get all documents for a trip
export const getTripDocuments = async (req, res) => {
  try {
    const { tripId } = req.params;
    const userId = req.user._id;

    // Verify user has permission to access this trip
    const trip = await Trip.findOne({
      _id: tripId,
      'participants.user': userId,
      'participants.status': 'accepted'
    });

    if (!trip) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access documents for this trip'
      });
    }

    // Get all documents for this trip
    const documents = await Document.find({ tripId })
      .populate('uploadedBy', 'username fullName email')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: documents.length,
      data: documents
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Delete a document
export const deleteDocument = async (req, res) => {
  try {
    const { tripId, documentId } = req.params;
    const userId = req.user._id;

    // Get the document
    const document = await Document.findById(documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Verify the document belongs to the specified trip
    if (document.tripId.toString() !== tripId) {
      return res.status(400).json({
        success: false,
        message: 'Document does not belong to this trip'
      });
    }

    // Check if user has permission (admin, the uploader, or an editor)
    const trip = await Trip.findOne({
      _id: tripId,
      'participants.user': userId,
      'participants.status': 'accepted'
    });

    if (!trip) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this trip'
      });
    }

    const participant = trip.participants.find(
      p => p.user && p.user.toString() === userId.toString()
    );

    const isAdmin = participant.role === 'admin';
    const isUploader = document.uploadedBy.toString() === userId.toString();
    const isEditor = participant.role === 'editor';

    if (!(isAdmin || isUploader || isEditor)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this document'
      });
    }

    // Store document name for notification
    const documentName = document.name;

    // Delete the document
    await Document.findByIdAndDelete(documentId);

    // Send notification about the deleted document
    await sendDocumentNotification(tripId, userId, 'deleted', documentName);

    // Emit socket event to trip participants
    if (req.io) {
      req.io.to(`trip-${tripId}`).emit('document-deleted', documentId);
    }

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};