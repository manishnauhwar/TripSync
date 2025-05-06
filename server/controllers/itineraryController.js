import Trip from '../models/tripModel.js';

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

    const newItem = {
      day,
      title,
      description,
      location,
      startTime,
      endTime,
      order: maxOrder + 1
    };

    trip.itinerary.push(newItem);
    await trip.save();

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

    item.day = day || item.day;
    item.title = title || item.title;
    item.description = description !== undefined ? description : item.description;
    item.location = location !== undefined ? location : item.location;
    item.startTime = startTime || item.startTime;
    item.endTime = endTime || item.endTime;

    await trip.save();

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

    trip.itinerary.pull(itemId);
    await trip.save();

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

    console.log(`Reordering itinerary items for trip: ${tripId}, day: ${day}`);
    console.log('Items to reorder:', JSON.stringify(items));

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

    for (const item of items) {
      const itineraryItem = trip.itinerary.id(item.id);
      if (itineraryItem) {
        itineraryItem.order = item.order;
        
        // Also update start and end times if provided
        if (item.startTime) {
          itineraryItem.startTime = new Date(item.startTime);
        }
        
        if (item.endTime) {
          itineraryItem.endTime = new Date(item.endTime);
        }
      }
    }

    await trip.save();

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