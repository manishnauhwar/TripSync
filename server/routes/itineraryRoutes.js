import express from 'express';
import { 
  getItinerary, 
  addItineraryItem, 
  updateItineraryItem, 
  deleteItineraryItem, 
  reorderItineraryItems 
} from '../controllers/itineraryController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import Trip from '../models/tripModel.js';

const router = express.Router();

router.use(authenticateUser);

router.get('/:tripId/itinerary-debug', async (req, res) => {
  try {
    const tripId = req.params.tripId;
    const userId = req.user._id;
    
    console.log(`[DEBUG] Fetching itinerary for trip: ${tripId}, user: ${userId}`);
    
    const trip = await Trip.findById(tripId);
    
    if (!trip) {
      console.log(`[DEBUG] Trip not found: ${tripId}`);
      return res.status(200).json({
        success: false,
        debug: true,
        message: 'Trip not found',
        tripId,
        userId
      });
    }
    
    const isParticipant = trip.participants.some(
      p => p.user && p.user.toString() === userId.toString()
    );
    
    console.log(`[DEBUG] User is participant: ${isParticipant}`);
    console.log(`[DEBUG] Itinerary items: ${trip.itinerary.length}`);
    
    return res.status(200).json({
      success: true,
      debug: true,
      tripName: trip.name,
      participantsCount: trip.participants.length,
      itineraryCount: trip.itinerary.length,
      isUserParticipant: isParticipant,
      startDate: trip.startDate,
      endDate: trip.endDate
    });
  } catch (error) {
    console.error(`[DEBUG] Error: ${error.message}`);
    return res.status(200).json({
      success: false,
      debug: true,
      error: error.message,
      stack: error.stack
    });
  }
});

router.get('/:tripId/itinerary', getItinerary);
router.post('/:tripId/itinerary', addItineraryItem);
router.put('/:tripId/itinerary/:itemId', updateItineraryItem);
router.delete('/:tripId/itinerary/:itemId', deleteItineraryItem);
router.put('/:tripId/itinerary-reorder', reorderItineraryItems);

export default router; 