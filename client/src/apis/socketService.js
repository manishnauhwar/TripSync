import { io } from 'socket.io-client';
import { endpoint } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = {};
  }

  async connect() {
    try {
      // Get the auth token
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.log('No token found, cannot connect to socket');
        return false;
      }

      // Create socket connection
      this.socket = io(endpoint, {
        auth: {
          token
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionAttempts: Infinity
      });

      // Set up event listeners
      this.socket.on('connect', this._handleConnect.bind(this));
      this.socket.on('disconnect', this._handleDisconnect.bind(this));
      this.socket.on('error', this._handleError.bind(this));

      return true;
    } catch (error) {
      console.error('Socket connection error:', error);
      return false;
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Join a trip's chat room
  joinTrip(tripId) {
    if (this.isConnected && this.socket) {
      this.socket.emit('join-trip', tripId);
    }
  }

  // Send a message
  sendMessage(tripId, content, type = 'text', mediaUrl = null, location = null) {
    if (this.isConnected && this.socket) {
      this.socket.emit('send-message', {
        tripId,
        content,
        type,
        mediaUrl,
        location
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
    console.log('Socket connected');
    this.isConnected = true;
  }

  _handleDisconnect() {
    console.log('Socket disconnected');
    this.isConnected = false;
  }

  _handleError(error) {
    console.error('Socket error:', error);
  }
}

// Create a singleton instance
const socketService = new SocketService();

export default socketService; 