import config from '../config/index.js';

const generateInviteLink = (tripId, email) => {
    // Encode email to handle special characters
    const encodedEmail = encodeURIComponent(email);
    
    // Generate deep link
    const deepLink = `tripsync://invite/${tripId}/${encodedEmail}`;
 
    const webUrl = `${config.webUrl}/invite/${tripId}/${encodedEmail}`;
    
    return {
        deepLink,
        webUrl
    };
};

export { generateInviteLink }; 