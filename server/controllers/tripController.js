import Trip from '../models/tripModel.js';
import User from '../models/userModal.js';
import { sendInvitationEmail } from '../config/emailConfig.js';

export const createTrip = async (req, res) => {
  try {
    const { name, description, startDate, endDate } = req.body;
    const userId = req.user._id;

    const trip = await Trip.create({
      name,
      description,
      startDate,
      endDate,
      creator: userId,
      participants: [{
        user: userId,
        email: req.user.email,
        role: 'admin',
        status: 'accepted'
      }]
    });

    res.status(201).json({
      success: true,
      data: trip
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getUserTrips = async (req, res) => {
  try {
    const userId = req.user._id;

    const trips = await Trip.find({
      'participants.user': userId,
      'participants.status': 'accepted'
    }).populate('creator', 'username fullName email');

    res.status(200).json({
      success: true,
      count: trips.length,
      data: trips
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const getTrip = async (req, res) => {
  try {
    const tripId = req.params.id;
    const userId = req.user._id;

    const trip = await Trip.findOne({
      _id: tripId,
      'participants.user': userId,
      'participants.status': 'accepted'
    }).populate('creator', 'username fullName email')
      .populate('participants.user', 'username fullName email');

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found or you do not have access'
      });
    }

    res.status(200).json({
      success: true,
      data: trip
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const inviteToTrip = async (req, res) => {
  try {
    const { email, role } = req.body;
    const tripId = req.params.id;
    const userId = req.user._id;

    console.log('Inviting user to trip:', { email, role, tripId });
    
    const trip = await Trip.findById(tripId).populate('creator', 'username fullName email');

    if (!trip) {
      console.log('Trip not found with ID:', tripId);
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    const userParticipant = trip.participants.find(
      p => p.user && p.user.toString() === userId.toString()
    );

    if (!userParticipant) {
      console.log('User is not a participant of this trip');
      return res.status(403).json({
        success: false,
        message: 'You must be a participant of this trip to invite others'
      });
    }

    let assignedRole = 'viewer'; 
    if (userParticipant.role === 'admin' && role) {
      if (role === 'editor' || role === 'viewer') {
        assignedRole = role;
      } else {
        console.log('Invalid role requested:', role);
      }
    }

    const existingParticipant = trip.participants.find(p => p.email === email);
    if (existingParticipant) {
      console.log('User already invited:', { email, status: existingParticipant.status });
      return res.status(400).json({
        success: false,
        message: 'User is already invited to this trip'
      });
    }

    const user = await User.findOne({ email });
    console.log('User found in system:', user ? 'Yes' : 'No');
    
    const newParticipant = {
      email,
      role: assignedRole,
      status: 'invited'
    };
    
    if (user) {
      newParticipant.user = user._id;
      console.log('Adding user ID to participant:', user._id);
    } else {
      console.log('User not found in database, inviting by email only');
    }
    
    trip.participants.push(newParticipant);
    console.log('Added new participant:', newParticipant);

    const savedTrip = await trip.save();
    console.log('Trip saved successfully, participants count:', savedTrip.participants.length);

    const inviterName = req.user.fullName || req.user.username || 'A TripSync user';
    console.log('Sending invitation email from:', inviterName);
    
    const emailResult = await sendInvitationEmail(
      email,
      trip.name,
      inviterName,
      tripId,
      assignedRole
    );

    if (!emailResult.success) {
      console.error('Failed to send invitation email:', emailResult.error);
      
    } else {
      console.log('Email sent successfully with ID:', emailResult.messageId);
    }

    res.status(200).json({
      success: true,
      message: 'Invitation sent successfully',
      data: trip
    });
  } catch (error) {
    console.error('Invitation error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const updateParticipantRole = async (req, res) => {
  try {
    const { participantId, newRole } = req.body;
    const tripId = req.params.id;
    const userId = req.user._id;

    const trip = await Trip.findById(tripId);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    const userParticipant = trip.participants.find(
      p => p.user.toString() === userId.toString()
    );

    if (!userParticipant || userParticipant.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can update participant roles'
      });
    }

    const participant = trip.participants.id(participantId);
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant not found'
      });
    }

    // Validate the new role
    if (newRole !== 'editor' && newRole !== 'viewer') {
      return res.status(400).json({
        success: false,
        message: 'Invalid role specified. Role must be either "editor" or "viewer"'
      });
    }

    participant.role = newRole;
    await trip.save();

    res.status(200).json({
      success: true,
      message: 'Participant role updated successfully',
      data: trip
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const acceptInvitation = async (req, res) => {
  try {
    const { email } = req.body;
    const tripId = req.params.id;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const trip = await Trip.findById(tripId);

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    const participantIndex = trip.participants.findIndex(p => p.email === email);
    
    if (participantIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found for this email'
      });
    }

    trip.participants[participantIndex].status = 'accepted';
    if (req.isAuthenticated && req.user) {
      const participant = trip.participants[participantIndex];
      if (!participant.user) {
        participant.user = req.user._id;
      } 
      else if (participant.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'This invitation belongs to a different user account'
        });
      }
    }

    await trip.save();

    const responseData = {
      success: true,
      message: 'Invitation accepted successfully',
      tripId: trip._id,
      tripName: trip.name,
      requiresAuth: !req.isAuthenticated
    };
    if (!req.isAuthenticated) {
      responseData.message += ' (Login required to join trip)';
      responseData.email = email; 
    }

    res.status(200).json(responseData);
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
}; 