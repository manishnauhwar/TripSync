import dotenv from 'dotenv';

dotenv.config();

const config = {
    webUrl: process.env.WEB_URL || 'https://tripsync.app',
    apiUrl: process.env.API_URL || 'http://localhost:3000',
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    // Add other configuration variables as needed
};

export default config; 