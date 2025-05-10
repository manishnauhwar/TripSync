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
    return axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }
};

// Helper to create form data request
const createFormDataRequest = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    console.log('Creating form data request with token:', token ? 'Present' : 'Missing');
    
    return axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'multipart/form-data',
        'Accept': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      timeout: 30000, // 30 second timeout for uploads
    });
  } catch (error) {
    console.error('Error creating form data request:', error);
    return axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'multipart/form-data',
        'Accept': 'application/json',
      },
      timeout: 30000, // 30 second timeout for uploads
    });
  }
};

const api = {
  API_URL,
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
        console.log('Token saved:', response.data.token);
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
      console.log('Update itinerary endpoint:', `${API_URL}${endpoint}`);
      console.log('Item data:', JSON.stringify(itemData));
      
      const response = await instance.put(endpoint, itemData);
      console.log('Update itinerary response status:', response.status);
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
      console.log('Delete itinerary endpoint:', `${API_URL}${endpoint}`);
      
      const response = await instance.delete(endpoint);
      console.log('Delete itinerary response status:', response.status);
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
      console.log('Reorder itinerary endpoint:', `${API_URL}${endpoint}`);
      console.log('Items data:', JSON.stringify({ day, items }));
      
      const response = await instance.put(endpoint, { day, items });
      console.log('Reorder itinerary response status:', response.status);
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

  uploadMedia: async (formData) => {
    try {
      console.log('============ MEDIA UPLOAD START ============');
      
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.log('Warning: No authentication token found');
      }
      
      const instance = axios.create({
        baseURL: API_URL,
        headers: {
          'Content-Type': 'multipart/form-data',
          'Accept': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        timeout: 60000, 
      });
      
      console.log('Sending upload request to:', `${API_URL}/api/chat/upload`);
      const response = await instance.post('/api/chat/upload', formData);
      
      console.log('Upload response status:', response.status);
      console.log('Upload response data:', response.data);
      console.log('============ MEDIA UPLOAD SUCCESS ============');
      
      return { success: true, data: response.data };
    } catch (error) {
      console.log('============ MEDIA UPLOAD ERROR ============');
      console.log('Error type:', error.name);
      console.log('Error message:', error.message);
      
      if (error.response) {
        console.log('Server responded with status:', error.response.status);
        console.log('Response data:', error.response.data);
      } else if (error.request) {
        console.log('No response received from server');
        console.log('Request details:', error.request);
      } else {
        console.log('Error setting up request:', error.message);
      }
      
      console.log('============ MEDIA UPLOAD ERROR END ============');
      
      return { 
        success: false, 
        error: error?.response?.data?.message || error.message || 'Upload failed'
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

  deleteMessage: async (tripId, messageId, deleteForEveryone = false) => {
    try {
      const instance = await createAuthenticatedRequest();
      const response = await instance.delete(`/api/chat/messages/${tripId}/${messageId}`, {
        data: { deleteForEveryone }
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.log('Delete message error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to delete message' 
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
  },

  getTripExpenses: async (tripId) => {
    try {
      console.log('Fetching expenses for trip:', tripId);
      const instance = await createAuthenticatedRequest();
      const response = await instance.get(`/api/trips/${tripId}/expenses`);
      
      console.log('Expenses API response status:', response.status);
      console.log('Raw expenses data:', response.data);
      
      let expensesData = [];
      
      if (response.data && Array.isArray(response.data)) {
        expensesData = response.data;
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        expensesData = response.data.data;
      } else if (response.data) {
        console.log('Unexpected expenses data structure:', response.data);
        expensesData = [];
      }
      
      console.log('Processed expenses data (count):', expensesData.length);
      return { success: true, data: expensesData };
    } catch (error) {
      console.log('Get expenses error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to fetch expenses' 
      };
    }
  },
  
  addTripExpense: async (tripId, expenseData) => {
    try {
      const instance = await createAuthenticatedRequest();
      const response = await instance.post(`/api/trips/${tripId}/expenses`, expenseData);
      return { success: true, data: response.data };
    } catch (error) {
      console.log('Add expense error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to add expense' 
      };
    }
  },

  exportTripExpensesPdf: async (tripId) => {
    try {
      console.log('Requesting PDF export from server for trip:', tripId);
      const instance = await createAuthenticatedRequest();
      
      const response = await instance.get(`/api/trips/${tripId}/expenses/export-pdf`);
      
      console.log('Export PDF response:', response.data);
      
      if (response.data && response.data.pdfUrl) {
        return { 
          success: true, 
          data: { 
            url: response.data.pdfUrl,
            message: 'PDF generated successfully'
          } 
        };
      } else {
        return { 
          success: false, 
          error: 'Server generated PDF but did not provide a download URL' 
        };
      }
    } catch (error) {
      console.log('Export PDF error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to export expenses as PDF' 
      };
    }
  },

  getLocationCoordinates: async (location) => {
    try {
      console.log('Getting coordinates for location:', location);
      if (!location) return { success: false, error: 'No location provided' };
      
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: location,
          format: 'json',
          limit: 1
        },
        headers: {
          'User-Agent': 'TripSync/1.0'
        }
      });
      
      if (response.data && response.data.length > 0) {
        const coordinates = {
          lat: parseFloat(response.data[0].lat),
          lon: parseFloat(response.data[0].lon),
          displayName: response.data[0].display_name
        };
        console.log('Coordinates found:', coordinates);
        return { success: true, data: coordinates };
      } else {
        console.log('No coordinates found for location:', location);
        return { success: false, error: 'Location not found' };
      }
    } catch (error) {
      console.error('Error getting location coordinates:', error);
      return { 
        success: false, 
        error: error?.message || 'Failed to get location coordinates' 
      };
    }
  },

  registerDevice: async (deviceId, fcmToken, platform) => {
    try {
      const instance = await createAuthenticatedRequest();
      const response = await instance.post('/api/notifications/register-device', {
        deviceId,
        fcmToken,
        platform
      });
      return response.data;
    } catch (error) {
      console.error('Error registering device:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  },

  updateDeviceActivity: async (deviceId) => {
    try {
      const instance = await createAuthenticatedRequest();
      const response = await instance.post('/api/notifications/update-activity', {
        deviceId
      });
      return response.data;
    } catch (error) {
      console.error('Error updating device activity:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  },

  // Document management APIs
  getTripDocuments: async (tripId) => {
    try {
      console.log('Fetching documents for trip:', tripId);
      const instance = await createAuthenticatedRequest();
      const response = await instance.get(`/api/trips/${tripId}/documents`);
      
      return { 
        success: true, 
        data: response.data.data || [] 
      };
    } catch (error) {
      console.log('Get documents error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to fetch documents' 
      };
    }
  },
  
  uploadTripDocument: async (tripId, documentData) => {
    try {
      console.log('Uploading document to trip:', tripId);
      
      // Check if this is a PDF and ensure proper type
      const isPdf = (documentData.fileType && 
        (documentData.fileType.includes('pdf') || documentData.fileType === 'application/pdf')) ||
        (documentData.name && documentData.name.toLowerCase().endsWith('.pdf'));
        
      if (isPdf && documentData.fileType !== 'application/pdf') {
        console.log('Correcting PDF fileType for upload');
        documentData.fileType = 'application/pdf';
      }
      
      const instance = await createAuthenticatedRequest();
      const response = await instance.post(`/api/trips/${tripId}/documents`, documentData);
      
      return { 
        success: true, 
        data: response.data.data 
      };
    } catch (error) {
      console.log('Upload document error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to upload document' 
      };
    }
  },
  
  deleteTripDocument: async (tripId, documentId) => {
    try {
      console.log('Deleting document:', documentId, 'from trip:', tripId);
      const instance = await createAuthenticatedRequest();
      const response = await instance.delete(`/api/trips/${tripId}/documents/${documentId}`);
      
      return { 
        success: true, 
        message: response.data.message || 'Document deleted successfully' 
      };
    } catch (error) {
      console.log('Delete document error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Failed to delete document' 
      };
    }
  },

  googleLogin: async (userData) => {
    try {
      const response = await axios.post(`${API_URL}/api/users/google-login`, userData, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (response.data.token) {
        await AsyncStorage.setItem('token', response.data.token);
        if (response.data.user) {
          await AsyncStorage.setItem('userDetails', JSON.stringify(response.data.user));
        }
        AsyncStorage.setItem('_lastAuthChange', Date.now().toString());
      }

      return { success: true, data: response.data };
    } catch (error) {
      console.log('Google login error:', error?.response?.data?.message || error.message);
      return { 
        success: false, 
        error: error?.response?.data?.message || 'Google login failed' 
      };
    }
  },
};

export default api;
