import Trip from '../models/tripModel.js';
import axios from 'axios';
import { 
  sendItineraryUpdateNotification, 
  scheduleItineraryReminders 
} from './notificationController.js';

// Helper function to fetch coordinates from OpenStreetMap API
const fetchCoordinates = async (location) => {
  if (!location) return null;
  
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: location,
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'TripSync/1.0'
      }
    });
    
    if (response.data && response.data.length > 0) {
      return {
        lat: parseFloat(response.data[0].lat),
        lon: parseFloat(response.data[0].lon),
        displayName: response.data[0].display_name
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching coordinates:', error.message);
    return null;
  }
};

export const getItinerary = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const userId = req.user._id;

    console.log(`Fetching itinerary for trip: ${tripId}, user: ${userId}`);

    const trip = await Trip.findOne({
      _id: tripId,
      'participants.user': userId
    });

    if (!trip) {
      console.log(`Trip not found or user not authorized: ${tripId}`);
      return res.status(404).json({
        success: false,
        message: 'Trip not found or you do not have access'
      });
    }

    console.log(`Found itinerary with ${trip.itinerary.length} items`);
    res.status(200).json({
      success: true,
      data: {
        data: trip.itinerary || []
      }
    });
  } catch (error) {
    console.error(`Error fetching itinerary: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const addItineraryItem = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const userId = req.user._id;
    const { day, title, description, location, startTime, endTime } = req.body;

    console.log(`Adding itinerary item for trip: ${tripId}, day: ${day}`);

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

    const userParticipant = trip.participants.find(
      p => p.user.toString() === userId.toString()
    );

    if (!userParticipant || (userParticipant.role !== 'admin' && userParticipant.role !== 'editor')) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to add itinerary items'
      });
    }

    const maxOrder = trip.itinerary
      .filter(item => item.day === day)
      .reduce((max, item) => Math.max(max, item.order || 0), -1);

    // Fetch coordinates for the location if provided
    let coordinates = null;
    if (location) {
      coordinates = await fetchCoordinates(location);
      console.log(`Coordinates fetched for ${location}:`, coordinates);
    }

    const newItem = {
      day,
      title,
      description,
      location,
      startTime,
      endTime,
      order: maxOrder + 1,
      coordinates
    };

    trip.itinerary.push(newItem);
    await trip.save();

    // Get the ID of the newly added item
    const addedItem = trip.itinerary[trip.itinerary.length - 1];
    
    // Send notification about the new item
    await sendItineraryUpdateNotification(tripId, 'add', title, userId);
    
    // Schedule reminder notification if start time is in the future
    if (startTime && new Date(startTime) > new Date()) {
      await scheduleItineraryReminders(tripId, addedItem._id);
    }

    res.status(201).json({
      success: true,
      data: {
        data: newItem
      }
    });
  } catch (error) {
    console.error(`Error adding itinerary item: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const updateItineraryItem = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const itemId = req.params.itemId;
    const userId = req.user._id;
    const { day, title, description, location, startTime, endTime } = req.body;

    console.log(`Updating itinerary item: ${itemId} for trip: ${tripId}`);

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

    const userParticipant = trip.participants.find(
      p => p.user.toString() === userId.toString()
    );

    if (!userParticipant || (userParticipant.role !== 'admin' && userParticipant.role !== 'editor')) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update itinerary items'
      });
    }

    const item = trip.itinerary.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Itinerary item not found'
      });
    }
    
    // Store old values for comparison
    const oldStartTime = new Date(item.startTime);
    const oldTitle = item.title;

    // Check if location has changed and fetch new coordinates if needed
    let coordinates = item.coordinates;
    if (location !== undefined && location !== item.location) {
      coordinates = await fetchCoordinates(location);
      console.log(`Updated coordinates fetched for ${location}:`, coordinates);
    }

    item.day = day || item.day;
    item.title = title || item.title;
    item.description = description !== undefined ? description : item.description;
    item.location = location !== undefined ? location : item.location;
    item.startTime = startTime || item.startTime;
    item.endTime = endTime || item.endTime;
    item.coordinates = coordinates;

    await trip.save();
    
    // Send notification about the updated item
    await sendItineraryUpdateNotification(tripId, 'update', item.title, userId);
    
    // If start time was changed, reschedule the reminder
    const newStartTime = new Date(item.startTime);
    if (newStartTime.getTime() !== oldStartTime.getTime() || item.title !== oldTitle) {
      if (newStartTime > new Date()) {
        await scheduleItineraryReminders(tripId, itemId);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        data: item
      }
    });
  } catch (error) {
    console.error(`Error updating itinerary item: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const deleteItineraryItem = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const itemId = req.params.itemId;
    const userId = req.user._id;

    console.log(`Deleting itinerary item: ${itemId} for trip: ${tripId}`);

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

    const userParticipant = trip.participants.find(
      p => p.user.toString() === userId.toString()
    );

    if (!userParticipant || (userParticipant.role !== 'admin' && userParticipant.role !== 'editor')) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete itinerary items'
      });
    }

    const item = trip.itinerary.id(itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Itinerary item not found'
      });
    }
    
    // Save the title before deletion
    const itemTitle = item.title;

    // Remove the item
    trip.itinerary.pull(itemId);
    await trip.save();
    
    // Send notification about the deleted item
    await sendItineraryUpdateNotification(tripId, 'delete', itemTitle, userId);

    res.status(200).json({
      success: true,
      message: 'Itinerary item deleted successfully'
    });
  } catch (error) {
    console.error(`Error deleting itinerary item: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const reorderItineraryItems = async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const userId = req.user._id;
    const { day, items } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Items must be an array'
      });
    }

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

    const userParticipant = trip.participants.find(
      p => p.user.toString() === userId.toString()
    );

    if (!userParticipant || (userParticipant.role !== 'admin' && userParticipant.role !== 'editor')) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to reorder itinerary items'
      });
    }

    // Update each item's order and times based on the provided order
    for (const item of items) {
      const { id, order, startTime, endTime } = item;
      const existingItem = trip.itinerary.id(id);
      
      if (existingItem) {
        existingItem.order = order;
        if (startTime) existingItem.startTime = startTime;
        if (endTime) existingItem.endTime = endTime;
      }
    }

    await trip.save();
    
    // Send notification about the reordering
    await sendItineraryUpdateNotification(tripId, 'reorder', 'Itinerary', userId);

    res.status(200).json({
      success: true,
      message: 'Itinerary items reordered successfully'
    });
  } catch (error) {
    console.error(`Error reordering itinerary items: ${error.message}`);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}; 