import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

export const sendInvitationEmail = async (recipientEmail, tripName, inviterName, tripId, role) => {
  const appScheme = process.env.APP_SCHEME || 'tripsync';
  const appStoreLink = process.env.APP_STORE_LINK || 'https://apps.apple.com/app/tripsync';
  const playStoreLink = process.env.PLAY_STORE_LINK || 'https://play.google.com/store/apps/details?id=com.tripsync.app';
  
  // Simple deep link format
  const deepLink = `${appScheme}://invite/${tripId}/${encodeURIComponent(recipientEmail)}`;
  
  const roleDisplay = {
    admin: 'Creator (full control)',
    editor: 'Editor',
    viewer: 'companion'
  };
  
  const mailOptions = {
    from: `"TripSync" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: `${inviterName} invited you to join "${tripName}" on TripSync`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #6200ea; margin-bottom: 20px;">Join "${tripName}" on TripSync</h2>
        
        <p style="margin-bottom: 15px; font-size: 16px;">
          <strong>${inviterName}</strong> has invited you to join a trip on TripSync.
        </p>
        
        <p style="margin-bottom: 15px; font-size: 16px;">
          <strong>Trip Name:</strong> ${tripName}<br/>
          <strong>Your Role:</strong> ${roleDisplay[role] || 'Participant'}
        </p>
        
        <div style="margin: 30px 0;">
          <a href="${deepLink}" 
             style="background-color: #6200ea; 
                    color: #ffffff; 
                    padding: 12px 25px; 
                    text-decoration: none; 
                    border-radius: 4px; 
                    font-weight: bold; 
                    display: inline-block; 
                    margin-bottom: 15px;
                    cursor: pointer;
                    transition: background-color 0.3s ease;
                    text-align: center;
                    min-width: 200px;"
             onmouseover="this.style.backgroundColor='#5000ca'"
             onmouseout="this.style.backgroundColor='#6200ea'"
             onclick="window.location.href='${deepLink}'; setTimeout(function() { window.location.href='${playStoreLink}'; }, 2000);">
            Accept Invitation
          </a>
        </div>
        
        <p style="color: #757575; font-size: 14px;">
          Click the button above to open the TripSync app and accept the invitation.
        </p>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #f5f5f5; border-radius: 4px;">
          <p style="margin: 0; color: #666; font-size: 14px;">
            <strong>Don't have the app?</strong><br/>
            Download TripSync from:
            <br/><br/>
            <a href="${playStoreLink}" style="color: #6200ea; text-decoration: none; margin-right: 15px;">Google Play Store</a>
            <a href="${appStoreLink}" style="color: #6200ea; text-decoration: none;">App Store</a>
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
        
        <p style="color: #757575; font-size: 13px;">
          TripSync - Plan trips together, travel better.
        </p>
      </div>
    `,
    text: `${inviterName} invited you to "${tripName}" on TripSync. Your role: ${roleDisplay[role] || 'Participant'}. Accept invitation: ${deepLink}`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error: error.message };
  }
};

export default transporter; 