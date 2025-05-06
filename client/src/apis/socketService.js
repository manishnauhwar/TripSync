import { io } from 'socket.io-client';
import { endpoint } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = {};
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectInterval = 2000; // Start with 2 seconds
  }

  async connect() {
    try {
      // If already connected, return 
      if (this.isConnected && this.socket) {
        console.log('Socket already connected, reusing connection');
        return true;
      }
      
      // Get the auth token
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.log('No token found, cannot connect to socket');
        return false;
      }

      console.log('Attempting to connect to socket server:', endpoint);
      
      // Create socket connection with better error handling
      this.socket = io(endpoint, {
        auth: {
          token
        },
        transports: ['websocket', 'polling'], // Try websocket first, fall back to polling
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        timeout: 10000, // 10 second connection timeout
        forceNew: true // Force a new connection
      });

      // Set up event listeners
      this.socket.on('connect', this._handleConnect.bind(this));
      this.socket.on('disconnect', this._handleDisconnect.bind(this));
      this.socket.on('error', this._handleError.bind(this));
      this.socket.on('connect_error', this._handleConnectError.bind(this));
      this.socket.on('reconnect_attempt', this._handleReconnectAttempt.bind(this));
      this.socket.on('reconnect', this._handleReconnect.bind(this));
      
      // Wait for connection or timeout
      return new Promise((resolve) => {
        // Set a timeout for connection
        const timeout = setTimeout(() => {
          console.log('Socket connection timeout');
          this.socket.close();
          resolve(false);
        }, 10000);
        
        // Connection successful
        this.socket.once('connect', () => {
          clearTimeout(timeout);
          resolve(true);
        });
        
        // Connection error
        this.socket.once('connect_error', (err) => {
          console.error('Socket connection error:', err);
          clearTimeout(timeout);
          resolve(false);
        });
      });
    } catch (error) {
      console.error('Socket connection error:', error);
      return false;
    }
  }

  disconnect() {
    if (this.socket) {
      console.log('Disconnecting socket');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Join a trip's chat room
  joinTrip(tripId) {
    if (this.isConnected && this.socket) {
      console.log(`Joining trip ${tripId} chat room`);
      this.socket.emit('join-trip', tripId);
    } else {
      console.warn('Cannot join trip, socket not connected');
      // Try to reconnect
      this.connect().then(connected => {
        if (connected) {
          this.socket.emit('join-trip', tripId);
        }
      });
    }
  }

  // Send a message
  sendMessage(tripId, content, type = 'text', mediaUrl = null, location = null) {
    if (this.isConnected && this.socket) {
      console.log('Emitting message via socket:', { tripId, content, type });
      this.socket.emit('send-message', {
        tripId,
        content,
        type,
        mediaUrl,
        location
      });
      return true;
    } else {
      console.log('Socket not connected, cannot send message');
      // Try to reconnect and send
      this.connect().then(connected => {
        if (connected) {
          this.socket.emit('send-message', {
            tripId,
            content,
            type,
            mediaUrl,
            location
          });
          return true;
        }
        return false;
      });
    }
  }

  // Start typing indicator
  sendTyping(tripId) {
    if (this.isConnected && this.socket) {
      this.socket.emit('typing', tripId);
    }
  }

  // Stop typing indicator
  sendStopTyping(tripId) {
    if (this.isConnected && this.socket) {
      this.socket.emit('stop-typing', tripId);
    }
  }

  // Add event listener
  on(event, callback) {
    if (this.socket) {
      // Keep track of listeners for removal
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
      
      this.socket.on(event, callback);
    }
  }

  // Remove event listener
  off(event, callback) {
    if (this.socket) {
      if (callback && this.listeners[event]) {
        // Remove specific callback
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        this.socket.off(event, callback);
      } else {
        // Remove all callbacks for this event
        if (this.listeners[event]) {
          this.listeners[event].forEach(cb => {
            this.socket.off(event, cb);
          });
          delete this.listeners[event];
        }
      }
    }
  }

  // Private methods
  _handleConnect() {
    console.log('Socket connected successfully');
    this.isConnected = true;
    this.reconnectAttempts = 0;
  }

  _handleDisconnect() {
    console.log('Socket disconnected');
    this.isConnected = false;
  }

  _handleError(error) {
    console.error('Socket error:', error);
  }
  
  _handleConnectError(error) {
    console.error('Socket connect_error:', error);
  }
  
  _handleReconnectAttempt(attempt) {
    console.log(`Socket reconnection attempt ${attempt}`);
  }
  
  _handleReconnect(attempt) {
    console.log(`Socket reconnected after ${attempt} attempts`);
    this.isConnected = true;
  }
}

// Create a singleton instance
const socketService = new SocketService();

export default socketService; 