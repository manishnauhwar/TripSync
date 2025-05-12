import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import connectDB from './configs/ConnectDb.js';
import userRouter from './routes/userRouter.js';
import tripRouter from './routes/tripRoutes.js';
import itineraryRouter from './routes/itineraryRoutes.js';
import chatRouter from './routes/chatRoutes.js';
import notificationRouter from './routes/notificationRoutes.js';
import documentRouter from './routes/documentRoutes.js'; 
import cloudinaryRouter from './routes/cloudinaryRoutes.js';
import invitationRouter from './routes/invitationRoutes.js';
import { protect } from './middleware/authMiddleware.js';
import jwt from 'jsonwebtoken';
import User from './models/userModal.js';
import cors from 'cors';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
        credentials: true
    }
});

const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
};

// Cloudinary configuration
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dgkvgk1ij',
    api_key: process.env.CLOUDINARY_API_KEY || '275526128117363',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'Pn4kD3PwTycPh_yMQHCKGzygfc0'
});

// Log Cloudinary config status
console.log('Cloudinary configured with:', {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dgkvgk1ij',
    api_key: process.env.CLOUDINARY_API_KEY ? 'Key provided' : 'Using fallback key',
    api_secret: process.env.CLOUDINARY_API_SECRET ? 'Secret provided' : 'Using fallback secret'
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the uploads directory - public access, no authentication required
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));
console.log('Main app serving static files from:', '/Uploads', '- publicly accessible');

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.url}`);
    console.log('Headers:', JSON.stringify(req.headers));
    next();
});

connectDB();

const connectedUsers = new Map();

io.on('connection', (socket) => {
    console.log('New client connected');

    const token = socket.handshake.auth.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            const userId = decoded.id;
            
            connectedUsers.set(userId, socket.id);
            socket.userId = userId;
            
            console.log(`User ${userId} authenticated and connected`);
            
            socket.on('join-trip', (tripId) => {
                socket.join(`trip-${tripId}`);
                io.to(`trip-${tripId}`).emit('user-online', userId);
                console.log(`User ${userId} joined trip ${tripId}`);
            });
            
            socket.on('send-message', async (data) => {
                const { tripId, content, type, mediaUrl, location } = data;
                
                try {
                    const user = await User.findById(userId).select('username fullName email');
                    if (!user) {
                        console.error('User not found for message:', userId);
                        return;
                    }
                    
                    io.to(`trip-${tripId}`).emit('new-message', {
                        _id: new mongoose.Types.ObjectId().toString(),
                        sender: {
                            _id: userId,
                            username: user.username,
                            fullName: user.fullName,
                            email: user.email
                        },
                        content,
                        type,
                        mediaUrl,
                        location,
                        createdAt: new Date(),
                        readBy: [userId]
                    });
                } catch (error) {
                    console.error('Error sending message:', error);
                }
            });
            
            socket.on('forward-message', (data) => {
                const { tripId, message } = data;
                if (!tripId || !message || !message._id) {
                    console.error('Invalid message format for forward-message');
                    return;
                }
                
                console.log(`User ${userId} forwarding message to trip ${tripId}`);
                io.to(`trip-${tripId}`).emit('new-message', message);
            });
            
            socket.on('delete-message', async (data) => {
                const { tripId, messageId, deleteForEveryone } = data;
                
                try {
                    // Notify all users in the chat about the deleted message
                    io.to(`trip-${tripId}`).emit('message-deleted', {
                        messageId,
                        deleteForEveryone
                    });
                    console.log(`User ${userId} deleted message ${messageId} in trip ${tripId} (for everyone: ${deleteForEveryone})`);
                } catch (error) {
                    console.error('Error handling message deletion:', error);
                }
            });
            
            socket.on('typing', (tripId) => {
                socket.to(`trip-${tripId}`).emit('user-typing', userId);
            });
            
            socket.on('stop-typing', (tripId) => {
                socket.to(`trip-${tripId}`).emit('user-stop-typing', userId);
            });
        } catch (error) {
            console.error('Socket authentication error:', error);
        }
    }

    socket.on('disconnect', () => {
        if (socket.userId) {
            connectedUsers.delete(socket.userId);
            io.emit('user-offline', socket.userId);
            console.log(`User ${socket.userId} disconnected`);
        }
        console.log('Client disconnected');
    });
});

app.use((req, res, next) => {
    req.io = io;
    req.connectedUsers = connectedUsers;
    next();
});

// Cloudinary signature endpoint
app.get('/get-signature', (req, res) => {
    try {
        const timestamp = Math.round(new Date().getTime() / 1000);
        // Use fallback if environment variable is not set
        const apiSecret = process.env.CLOUDINARY_API_SECRET || 'your_default_api_secret';
        
        // Try to use cloudinary utils if available
        let signature;
        try {
            signature = cloudinary.utils.api_sign_request(
                { timestamp },
                apiSecret
            );
        } catch (error) {
            // Fallback to manual signature calculation
            signature = crypto
                .createHash('sha1')
                .update(`timestamp=${timestamp}${apiSecret}`)
                .digest('hex');
        }
        
        res.json({ signature, timestamp });
    } catch (error) {
        console.error('Error generating signature:', error);
        res.status(500).json({ error: 'Failed to generate signature' });
    }
});

// Routes
app.use('/api/users', userRouter);
app.use('/api/trips', tripRouter);
app.use('/api/trips', itineraryRouter);
app.use('/api/chat', chatRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api', documentRouter); // Document routes
app.use('/api/cloudinary', cloudinaryRouter); // Cloudinary routes
app.use('/api/invitations', invitationRouter); // Invitation routes

app.get('/api/protected', protect, (req, res) => {
    res.json({ message: 'This is a protected route', userId: req.userId });
});

app.get('/', (req, res) => {
    res.send('Welcome to the TripSync API');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});