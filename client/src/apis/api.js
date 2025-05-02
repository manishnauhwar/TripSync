import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { endpoint } from '../config';

const API_URL = endpoint;

const createAuthenticatedRequest = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    console.log('Token for request:', token ? 'Found token' : 'No token');
    
    return axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
    });
  } catch (error) {
    console.error('Error creating authenticated request:', error);
    // Return a default instance without auth token if something went wrong
    return axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }
};

const api = {
  register: async (username, email, password, fullName, confirmPassword) => {
    try {
      const payload = {
        username,
        fullName,
        email,
        password,
        confirmPassword
      };

      console.log('Registering with:', { username, email, fullName });
      const response = await axios.post(`${API_URL}/api/users/register`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      console.log('Registration response:', response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.log('Register error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Registration failed. Please try again.' 
      };
    }
  },

  login: async (usernameOrEmail, password) => {
    try {
      const payload = {
        username_or_email: usernameOrEmail.toLowerCase().trim(),
        password,
      };

      console.log('Logging in with:', usernameOrEmail);
      const response = await axios.post(`${API_URL}/api/users/login`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      console.log('Login response received:', response.data ? 'Success' : 'Failed');
      
      if (response.data.token) {
        await AsyncStorage.setItem('token', response.data.token);
        if (response.data.user) {
          await AsyncStorage.setItem('userDetails', JSON.stringify(response.data.user));
        }
        
        // Trigger a re-render of the app to update navigation
        AsyncStorage.setItem('_lastAuthChange', Date.now().toString());
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.log('Login error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Invalid credentials' 
      };
    }
  },

  logout: async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('userDetails');
      
      // Trigger a re-render of the app to update navigation
      AsyncStorage.setItem('_lastAuthChange', Date.now().toString());
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  createTrip: async (tripData) => {
    try {
      const instance = await createAuthenticatedRequest();
      const response = await instance.post('/api/trips', tripData);
      return { success: true, data: response.data };
    } catch (error) {
      console.log('Create trip error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to create trip' 
      };
    }
  },

  getTrips: async () => {
    try {
      console.log('Creating authenticated request for getTrips');
      const instance = await createAuthenticatedRequest();
      console.log('API URL:', `${API_URL}/api/trips`);
      const response = await instance.get('/api/trips');
      console.log('GetTrips response status:', response.status);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get trips error:', error);
      console.log('Response data:', error?.response?.data);
      console.log('Response status:', error?.response?.status);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to fetch trips' 
      };
    }
  },

  getTripById: async (tripId) => {
    try {
      console.log('Getting trip by ID:', tripId);
      const instance = await createAuthenticatedRequest();
      const response = await instance.get(`/api/trips/${tripId}`);
      console.log('Get trip by ID response status:', response.status);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get trip error:', error);
      console.log('Response data:', error?.response?.data);
      console.log('Response status:', error?.response?.status);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to fetch trip details' 
      };
    }
  },

  inviteToTrip: async (tripId, email, role) => {
    try {
      const instance = await createAuthenticatedRequest();
      const response = await instance.post(`/api/trips/${tripId}/invite`, { email, role });
      return { success: true, data: response.data };
    } catch (error) {
      console.log('Invite to trip error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to send invitation' 
      };
    }
  },

  acceptInvitation: async (tripId, email) => {
    try {
      // Create a request with token if available, or without if not
      let headers = {};
      const token = await AsyncStorage.getItem('token');
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      
      const instance = axios.create({
        baseURL: API_URL,
        headers
      });
      
      const response = await instance.post(`/api/trips/${tripId}/accept-invitation`, { email });
      return { success: true, data: response.data };
    } catch (error) {
      console.log('Accept invitation error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to accept invitation' 
      };
    }
  },

  updateParticipantRole: async (tripId, participantId, newRole) => {
    try {
      const instance = await createAuthenticatedRequest();
      const response = await instance.patch(`/api/trips/${tripId}/participant-role`, {
        participantId,
        newRole
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.log('Update role error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to update participant role' 
      };
    }
  },

  getItinerary: async (tripId) => {
    try {
      console.log('Fetching itinerary for trip:', tripId);
      const instance = await createAuthenticatedRequest();
      const endpoint = `/api/trips/${tripId}/itinerary`;
      console.log('API endpoint:', `${API_URL}${endpoint}`);
      
      const token = await AsyncStorage.getItem('token');
      console.log('Token available for itinerary fetch:', !!token);
      
      const response = await instance.get(endpoint);
      console.log('Itinerary API response status:', response.status);
      console.log('Itinerary data received:', response.data ? 'Yes' : 'No');
      
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Get itinerary error details:', error);
      console.log('Error status:', error?.response?.status);
      console.log('Error data:', error?.response?.data);
      console.log('Error message:', error?.message);
      
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to fetch itinerary. Please try again.' 
      };
    }
  },

  addItineraryItem: async (tripId, itemData) => {
    try {
      console.log('Adding itinerary item for trip:', tripId);
      const instance = await createAuthenticatedRequest();
      const endpoint = `/api/trips/${tripId}/itinerary`;
      console.log('Add itinerary endpoint:', `${API_URL}${endpoint}`);
      console.log('Item data:', JSON.stringify(itemData));
      
      const response = await instance.post(endpoint, itemData);
      console.log('Add itinerary response status:', response.status);
      return { success: true, data: response.data };
    } catch (error) {
      console.log('Add itinerary item error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to add itinerary item' 
      };
    }
  },

  updateItineraryItem: async (tripId, itemId, itemData) => {
    try {
      console.log('Updating itinerary item:', itemId);
      const instance = await createAuthenticatedRequest();
      const endpoint = `/api/trips/${tripId}/itinerary/${itemId}`;
      
      const response = await instance.put(endpoint, itemData);
      return { success: true, data: response.data };
    } catch (error) {
      console.log('Update itinerary item error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to update itinerary item' 
      };
    }
  },

  deleteItineraryItem: async (tripId, itemId) => {
    try {
      console.log('Deleting itinerary item:', itemId);
      const instance = await createAuthenticatedRequest();
      const endpoint = `/api/trips/${tripId}/itinerary/${itemId}`;
      
      const response = await instance.delete(endpoint);
      return { success: true, data: response.data };
    } catch (error) {
      console.log('Delete itinerary item error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to delete itinerary item' 
      };
    }
  },

  reorderItineraryItems: async (tripId, day, items) => {
    try {
      console.log('Reordering itinerary items for day:', day);
      const instance = await createAuthenticatedRequest();
      const endpoint = `/api/trips/${tripId}/itinerary-reorder`;
      
      const response = await instance.put(endpoint, { day, items });
      return { success: true, data: response.data };
    } catch (error) {
      console.log('Reorder itinerary items error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to reorder itinerary items' 
      };
    }
  },

  getMessages: async (tripId) => {
    try {
      const instance = await createAuthenticatedRequest();
      const response = await instance.get(`/api/chat/messages/${tripId}`);
      return { success: true, data: response.data };
    } catch (error) {
      console.log('Get messages error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to fetch messages' 
      };
    }
  },

  sendMessage: async (tripId, content, type = 'text', mediaUrl, location) => {
    try {
      const instance = await createAuthenticatedRequest();
      const response = await instance.post(`/api/chat/messages/${tripId}`, {
        content,
        type,
        mediaUrl,
        location
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.log('Send message error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to send message' 
      };
    }
  },

  markMessagesAsRead: async (tripId, messageIds) => {
    try {
      const instance = await createAuthenticatedRequest();
      const response = await instance.put(`/api/chat/messages/${tripId}/read`, { messageIds });
      return { success: true, data: response.data };
    } catch (error) {
      console.log('Mark as read error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to mark messages as read' 
      };
    }
  },

  debugItinerary: async (tripId) => {
    try {
      console.log('DEBUG: Testing itinerary functionality for trip:', tripId);
      const instance = await createAuthenticatedRequest();
      const endpoint = `/api/trips/${tripId}/itinerary-debug`;
      console.log('DEBUG endpoint:', `${API_URL}${endpoint}`);
      
      const token = await AsyncStorage.getItem('token');
      console.log('DEBUG: Token available:', !!token);
      
      const response = await instance.get(endpoint);
      console.log('DEBUG response status:', response.status);
      console.log('DEBUG response data:', response.data);
      
      return { success: true, data: response.data };
    } catch (error) {
      console.error('DEBUG error details:', error);
      console.log('DEBUG error status:', error?.response?.status);
      console.log('DEBUG error data:', error?.response?.data);
      console.log('DEBUG error message:', error?.message);
      
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Debug request failed.' 
      };
    }
  }
};

export default api;
