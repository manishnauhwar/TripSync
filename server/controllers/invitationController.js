import Trip from '../models/tripModel.js';
import User from '../models/userModal.js';
import { generateInviteLink } from '../utils/linkGenerator.js';

const invitationController = {
    // Generate invitation link
    generateInviteLink: async (req, res) => {
        try {
            const { tripId, email } = req.body;

            if (!tripId || !email) {
                return res.status(400).json({ message: 'Trip ID and email are required' });
            }

            // Verify trip exists
            const trip = await Trip.findById(tripId);
            if (!trip) {
                return res.status(404).json({ message: 'Trip not found' });
            }

            // Generate deep link
            const inviteLink = generateInviteLink(tripId, email);
            res.json({ inviteLink });

        } catch (error) {
            console.error('Error generating invite link:', error);
            res.status(500).json({ message: 'Error generating invite link' });
        }
    },

    // Handle invitation acceptance
    acceptInvitation: async (req, res) => {
        try {
            const { tripId, email } = req.params;
            const userId = req.user.id;

            // Verify trip exists
            const trip = await Trip.findById(tripId);
            if (!trip) {
                return res.status(404).json({ message: 'Trip not found' });
            }

            // Verify user email matches invitation
            const user = await User.findById(userId);
            if (user.email.toLowerCase() !== email.toLowerCase()) {
                return res.status(403).json({ message: 'Email does not match invitation' });
            }

            // Add user to trip participants if not already added
            if (!trip.participants.includes(userId)) {
                trip.participants.push(userId);
                await trip.save();
            }

            res.json({ message: 'Invitation accepted successfully', trip });

        } catch (error) {
            console.error('Error accepting invitation:', error);
            res.status(500).json({ message: 'Error accepting invitation' });
        }
    }
};

export default invitationController;
