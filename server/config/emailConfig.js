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
  
  const deepLink = `${appScheme}://invite?tripId=${tripId}&email=${encodeURIComponent(recipientEmail)}`;
  
  const apkLink = process.env.APK_DOWNLOAD_URL || 'https://yourhost.com/download/tripsync.apk';
  
  const roleDisplay = {
    admin: 'Creator (full control)',
    editor: 'Editor (can edit trip details)',
    viewer: 'Viewer (can view trip details only)'
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
          <a href="${deepLink}" style="background-color: #6200ea; color: #ffffff; padding: 12px 25px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block; margin-bottom: 15px;">Accept Invitation</a>
        </div>
        
        <p style="color: #757575; font-size: 14px;">
          If you have the TripSync app installed, clicking the button above will open the app directly.
          If you don't have the app installed yet, <a href="${apkLink}" style="color: #6200ea; text-decoration: underline;">download it here</a> first.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
        
        <p style="color: #757575; font-size: 13px;">
          TripSync - Plan trips together, travel better.
        </p>
      </div>
    `,
    text: `${inviterName} invited you to "${tripName}" on TripSync. Your role: ${roleDisplay[role] || 'Participant'}. Accept invitation: ${deepLink} or download the app: ${apkLink}`
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