import Device from '../models/deviceModel.js';
import User from '../models/userModal.js';
import Trip from '../models/tripModel.js';
import { sendNotification, scheduleNotification } from '../configs/firebaseConfig.js';

// Register FCM token for a user
export const registerDevice = async (req, res) => {
  try {
    const { deviceId, fcmToken, platform } = req.body;
    const userId = req.user._id;

    if (!deviceId || !fcmToken || !platform) {
      return res.status(400).json({
        success: false,
        message: 'Device ID, FCM token, and platform are required',
      });
    }

    // Update FCM token if device already exists or create new device
    const device = await Device.findOneAndUpdate(
      { user: userId, deviceId },
      { 
        fcmToken, 
        platform, 
        lastActive: new Date() 
      },
      { new: true, upsert: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Device registered successfully',
      data: { deviceId: device.deviceId },
    });
  } catch (error) {
    console.error('Error registering device:', error);
    return res.status(500).json({
      success: false,
      message: 'Error registering device',
      error: error.message,
    });
  }
};

// Update device last active time
export const updateDeviceActivity = async (req, res) => {
  try {
    const { deviceId } = req.body;
    const userId = req.user._id;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Device ID is required',
      });
    }

    const device = await Device.findOneAndUpdate(
      { user: userId, deviceId },
      { lastActive: new Date() },
      { new: true }
    );

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Device not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Device activity updated',
    });
  } catch (error) {
    console.error('Error updating device activity:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating device activity',
      error: error.message,
    });
  }
};

// Helper function to get FCM tokens for trip participants
export const getParticipantTokens = async (tripId, excludeUserId = null) => {
  try {
    const trip = await Trip.findById(tripId).populate('participants.user');
    
    if (!trip) {
      throw new Error('Trip not found');
    }

    // Get user IDs from active participants
    const participantIds = trip.participants
      .filter(p => p.status === 'accepted' && (!excludeUserId || p.user._id.toString() !== excludeUserId.toString()))
      .map(p => p.user._id);

    // Get FCM tokens for those users
    const devices = await Device.find({
      user: { $in: participantIds },
    });

    return devices.map(device => device.fcmToken);
  } catch (error) {
    console.error('Error getting participant tokens:', error);
    return [];
  }
};

// Send chat notification
export const sendChatNotification = async (tripId, sender, message) => {
  try {
    // Get trip details
    const trip = await Trip.findById(tripId);
    if (!trip) {
      console.error('Trip not found for chat notification');
      return;
    }

    const senderUser = await User.findById(sender);
    if (!senderUser) {
      console.error('Sender user not found for chat notification');
      return;
    }

    // Get tokens for all participants except the sender
    const tokens = await getParticipantTokens(tripId, sender);
    
    if (tokens.length === 0) {
      console.log('No tokens found for participants');
      return;
    }

    // Send notification
    const title = `New message in ${trip.name}`;
    const body = `${senderUser.fullName || senderUser.username || senderUser.email}: ${message}`;
    
    await sendNotification(tokens, title, body, {
      tripId,
      type: 'chat',
      senderId: sender.toString(),
    });
  } catch (error) {
    console.error('Error sending chat notification:', error);
  }
};

// Send itinerary update notification
export const sendItineraryUpdateNotification = async (tripId, action, itemTitle, userId) => {
  try {
    // Get trip details
    const trip = await Trip.findById(tripId);
    if (!trip) {
      console.error('Trip not found for itinerary notification');
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error('User not found for itinerary notification');
      return;
    }

    // Get tokens for all participants except the updater
    const tokens = await getParticipantTokens(tripId, userId);
    
    if (tokens.length === 0) {
      console.log('No tokens found for participants');
      return;
    }

    // Customize message based on action
    const title = `Itinerary update for ${trip.name}`;
    let body = '';
    
    switch (action) {
      case 'add':
        body = `${user.fullName || user.username || user.email} added "${itemTitle}" to the itinerary`;
        break;
      case 'update':
        body = `${user.fullName || user.username || user.email} updated "${itemTitle}" in the itinerary`;
        break;
      case 'delete':
        body = `${user.fullName || user.username || user.email} removed "${itemTitle}" from the itinerary`;
        break;
      case 'reorder':
        body = `${user.fullName || user.username || user.email} reordered the itinerary`;
        break;
      default:
        body = `${user.fullName || user.username || user.email} made changes to the itinerary`;
    }
    
    await sendNotification(tokens, title, body, {
      tripId,
      type: 'itinerary_update',
      action,
      userId: userId.toString(),
    });
  } catch (error) {
    console.error('Error sending itinerary update notification:', error);
  }
};

// Schedule reminder notifications for upcoming itinerary items
export const scheduleItineraryReminders = async (tripId, itemId) => {
  try {
    // Get trip and itinerary item
    const trip = await Trip.findById(tripId);
    if (!trip) {
      console.error('Trip not found for scheduling reminders');
      return;
    }

    const item = trip.itinerary.id(itemId);
    if (!item) {
      console.error('Itinerary item not found for scheduling reminders');
      return;
    }

    // Calculate reminder time (5 minutes before start)
    const startTime = new Date(item.startTime);
    const reminderTime = new Date(startTime.getTime() - 5 * 60 * 1000); // 5 minutes before
    
    // Don't schedule if start time is in the past
    if (startTime <= new Date()) {
      console.log('Itinerary item start time is in the past, not scheduling reminder');
      return;
    }

    // Get tokens for all participants
    const tokens = await getParticipantTokens(tripId);
    
    if (tokens.length === 0) {
      console.log('No tokens found for participants');
      return;
    }

    // Schedule notification
    const title = `Upcoming: ${item.title}`;
    const body = `Your activity "${item.title}" in ${trip.name} starts in 5 minutes`;
    
    await scheduleNotification(tokens, title, body, reminderTime, {
      tripId,
      type: 'itinerary_reminder',
      itemId: itemId.toString(),
    });
    
    console.log(`Scheduled reminder for "${item.title}" at ${reminderTime.toISOString()}`);
  } catch (error) {
    console.error('Error scheduling itinerary reminder:', error);
  }
};

// Send document notification
export const sendDocumentNotification = async (tripId, userId, action, documentName) => {
  try {
    // Get trip details
    const trip = await Trip.findById(tripId);
    if (!trip) {
      console.error('Trip not found for document notification');
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      console.error('User not found for document notification');
      return;
    }

    // Get tokens for all participants except the user who performed the action
    const tokens = await getParticipantTokens(tripId, userId);
    
    if (tokens.length === 0) {
      console.log('No tokens found for participants');
      return;
    }

    // Customize message based on action
    const title = `Document ${action} in ${trip.name}`;
    let body = '';
    
    switch (action) {
      case 'uploaded':
        body = `${user.fullName || user.username || user.email} uploaded "${documentName}"`;
        break;
      case 'deleted':
        body = `${user.fullName || user.username || user.email} deleted "${documentName}"`;
        break;
      default:
        body = `${user.fullName || user.username || user.email} made changes to "${documentName}"`;
    }
    
    await sendNotification(tokens, title, body, {
      tripId,
      type: 'document',
      action,
      userId: userId.toString(),
      documentName
    });
  } catch (error) {
    console.error('Error sending document notification:', error);
  }
}; 