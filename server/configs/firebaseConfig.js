import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serviceAccount;
try {
  // Try to load service account from environment variable (for production)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('Firebase service account loaded from environment variable');
  } else {
    // For development, try to load from local file
    const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      console.log('Firebase service account loaded from local file');
    } else {
      console.warn('Firebase service account not found, notifications will not work');
    }
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin SDK initialized successfully');
  }
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
}

// Helper functions for sending notifications
const sendNotification = async (tokens, title, body, data = {}) => {
  if (!admin.apps.length) {
    console.error('Firebase Admin SDK not initialized, cannot send notification');
    return;
  }

  if (!tokens || tokens.length === 0) {
    console.log('No FCM tokens provided, skipping notification');
    return;
  }

  try {
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK', // For handling notification clicks
      },
      tokens: Array.isArray(tokens) ? tokens : [tokens],
    };

    const response = await admin.messaging().sendMulticast(message);
    console.log(`Successfully sent notifications: ${response.successCount}/${tokens.length}`);
    return response;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

// Schedule a notification to be sent at a specific time
const scheduleNotification = async (tokens, title, body, scheduledTime, data = {}) => {
  if (!admin.apps.length) {
    console.error('Firebase Admin SDK not initialized, cannot schedule notification');
    return;
  }

  const now = new Date();
  const targetTime = new Date(scheduledTime);
  
  if (targetTime <= now) {
    console.log('Target time is in the past, not scheduling notification');
    return;
  }

  const timeoutMs = targetTime.getTime() - now.getTime();
  console.log(`Scheduling notification to be sent in ${timeoutMs}ms (${Math.round(timeoutMs/1000/60)} minutes)`);

  setTimeout(() => {
    sendNotification(tokens, title, body, data)
      .catch(err => console.error('Failed to send scheduled notification:', err));
  }, timeoutMs);
  
  return { scheduled: true, timeoutMs };
};

export { sendNotification, scheduleNotification };
export default admin; 