import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import connectDB from './configs/ConnectDb.js';
import userRouter from './routes/userRouter.js';
import tripRouter from './routes/tripRoutes.js';
import itineraryRouter from './routes/itineraryRoutes.js';
import chatRouter from './routes/chatRoutes.js';
import { protect } from './middleware/authMiddleware.js';
import jwt from 'jsonwebtoken';
import User from './models/userModal.js';
import cors from 'cors';

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

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
                    io.to(`trip-${tripId}`).emit('new-message', {
                        sender: userId,
                        content,
                        type,
                        mediaUrl,
                        location,
                        createdAt: new Date()
                    });
                } catch (error) {
                    console.error('Error sending message:', error);
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

app.use('/api/users', userRouter);
app.use('/api/trips', tripRouter);
app.use('/api/trips', itineraryRouter);
app.use('/api/chat', chatRouter);

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
