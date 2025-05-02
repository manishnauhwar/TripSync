import Message from '../models/messageModel.js';
import Trip from '../models/tripModel.js';

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