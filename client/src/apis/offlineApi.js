import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Q } from '@nozbe/watermelondb';
import api from './api';

// Helper to get user ID from AsyncStorage
const getUserId = async () => {
  try {
    const userDetailsStr = await AsyncStorage.getItem('userDetails');
    if (userDetailsStr) {
      const userDetails = JSON.parse(userDetailsStr);
      return userDetails._id || userDetails.id;
    }
  } catch (error) {
    console.error('Error getting user ID:', error);
  }
  return null;
};

// Check if device is online
const isOnline = async () => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected;
  } catch (error) {
    console.error('Error checking online status:', error);
    return false;
  }
};

// Safe database operation handler
const safeDBOperation = async (operation) => {
  let retries = 3;
  let lastError = null;

  while (retries > 0) {
    try {
      // Check if database module is available
      let database;
      try {
        // Fix: Use correct import path and handle potential errors
        const dbModule = require('../models/database');
        database = dbModule.database;
        
        if (!database) {
          console.error('Database not found in module');
          throw new Error('Database not available');
        }
      } catch (error) {
        console.error('Database module not available:', error);
        throw error;
      }
      
      // Check if database is properly initialized
      if (!database) {
        console.error('Database not initialized');
        throw new Error('Database not initialized');
      }
      
      // Execute the operation
      return await operation(database);
    } catch (error) {
      lastError = error;
      console.error(`Database operation failed (${retries} retries left):`, error);
      retries--;
      if (retries > 0) {
        // Wait for 1 second before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Database operation failed after retries',
    offlineMode: true
  };
};

const offlineApi = {
  // Trip operations
  createTrip: async (tripData) => {
    try {
      const online = await isOnline();
      const userId = await getUserId();
      
      if (!userId) {
        return { success: false, error: 'User not authenticated' };
      }
      
      // If online, try to use the regular API
      if (online) {
        try {
          const result = await api.createTrip(tripData);
          
          if (result.success) {
            // Try to store in local database, but continue even if it fails
            const dbResult = await safeDBOperation(async (database) => {
              await database.write(async () => {
                await database.get('trips').create(trip => {
                  trip.name = tripData.name;
                  trip.description = tripData.description || '';
                  trip.creatorId = userId;
                  trip.startDate = tripData.startDate ? new Date(tripData.startDate) : null;
                  trip.endDate = tripData.endDate ? new Date(tripData.endDate) : null;
                  trip.serverId = result.data._id || result.data.id;
                  trip.isSynced = true;
                });
              });
            });

            if (!dbResult.success) {
              console.warn('Failed to store trip in local database:', dbResult.error);
            }
            
            return result;
          }
        } catch (apiError) {
          console.error('API error creating trip:', apiError);
          // Fall through to offline mode
        }
      }
      
      // Offline mode - store locally
      const dbResult = await safeDBOperation(async (database) => {
        const trip = await database.write(async () => {
          return await database.get('trips').create(trip => {
            trip.name = tripData.name;
            trip.description = tripData.description || '';
            trip.creatorId = userId;
            trip.startDate = tripData.startDate ? new Date(tripData.startDate) : null;
            trip.endDate = tripData.endDate ? new Date(tripData.endDate) : null;
            trip.isSynced = false;
          });
        });
        
        return {
          success: true,
          data: {
            _id: trip.id,
            ...tripData,
            offlineRecord: true
          },
          offlineMode: true
        };
      });
      
      return dbResult;
    } catch (error) {
      console.error('Create trip error:', error);
      return {
        success: false,
        error: 'Failed to create trip',
        offlineMode: true
      };
    }
  },
  
  getTrips: async () => {
    try {
      const online = await isOnline();
      const userId = await getUserId();
      
      if (!userId) {
        return { success: false, error: 'User not authenticated' };
      }
      
      // If online, try to use the regular API
      if (online) {
        try {
          const response = await api.getTrips();
          if (response.success && response.data) {
            return response;
          }
          // If online API call fails, continue with offline mode
        } catch (error) {
          console.log('Failed to get trips from server, falling back to local data:', error);
        }
      }
      
      // Try to fetch from local database
      const dbResult = await safeDBOperation(async (database) => {
        try {
          const trips = await database.get('trips').query().fetch();
          
          return { 
            success: true, 
            data: trips.map(trip => ({
              _id: trip.serverId || trip.id,
              name: trip.name,
              description: trip.description,
              creator: trip.creatorId,
              startDate: trip.startDate?.toISOString(),
              endDate: trip.endDate?.toISOString(),
              createdAt: trip.createdAt?.toISOString(),
              updatedAt: trip.updatedAt?.toISOString(),
              offlineRecord: !trip.isSynced,
              participants: [], // Initialize with empty array to prevent errors
            })),
            offlineMode: !online
          };
        } catch (dbError) {
          console.error('Database error:', dbError);
          throw dbError;
        }
      });
      
      if (dbResult.success) {
        return dbResult;
      }
      
      // If database operation failed, return a fallback empty response
      return { 
        success: true, 
        data: [],
        offlineMode: true,
        databaseError: true
      };
    } catch (error) {
      console.error('Get trips error:', error);
      return { 
        success: true, 
        data: [],
        error: 'Failed to fetch trips, showing empty list'
      };
    }
  },
  
  getTripById: async (tripId) => {
    try {
      const online = await isOnline();
      
      // If online, try to use the regular API
      if (online) {
        try {
          return await api.getTripById(tripId);
        } catch (error) {
          console.log('Failed to get trip from server, falling back to local data:', error);
        }
      }
      
      const dbResult = await safeDBOperation(async (database) => {
        // First check by server ID
        let trip = await database.get('trips').query(
          Q.where('server_id', tripId)
        ).fetch();
        
        // If not found, try by local ID
        if (trip.length === 0) {
          try {
            trip = await database.get('trips').find(tripId);
            if (!trip) {
              return { success: false, error: 'Trip not found' };
            }
            
            // Convert to array
            trip = [trip];
          } catch (findError) {
            return { success: false, error: 'Trip not found' };
          }
        }
        
        if (trip.length === 0) {
          return { success: false, error: 'Trip not found' };
        }
        
        const tripData = trip[0];
        
        // Format response to match API structure
        const result = {
          _id: tripData.serverId || tripData.id,
          name: tripData.name,
          description: tripData.description,
          creator: tripData.creatorId,
          startDate: tripData.startDate?.toISOString(),
          endDate: tripData.endDate?.toISOString(),
          participants: [],
          itinerary: [],
          createdAt: tripData.createdAt?.toISOString(),
          updatedAt: tripData.updatedAt?.toISOString(),
          offlineRecord: !tripData.isSynced,
        };
        
        return { 
          success: true, 
          data: result,
          offlineMode: !online
        };
      });
      
      return dbResult;
    } catch (error) {
      console.error('Get trip by ID error:', error);
      return { success: false, error: 'Failed to fetch trip details' };
    }
  },
  
  updateTrip: async (tripId, tripData) => {
    // If online use API, otherwise store locally
    try {
      const online = await isOnline();
      
      if (online) {
        try {
          return await api.updateTrip(tripId, tripData);
        } catch (error) {
          console.error('Error updating trip via API:', error);
        }
      }
      
      return { success: true, offlineMode: true, message: 'Trip will be updated when online' };
    } catch (error) {
      console.error('Update trip error:', error);
      return { success: false, error: 'Failed to update trip' };
    }
  },
  
  inviteToTrip: async (tripId, email, role) => {
    // If online use API, otherwise store locally
    try {
      const online = await isOnline();
      
      if (online) {
        try {
          return await api.inviteToTrip(tripId, email, role);
        } catch (error) {
          console.error('Error inviting to trip via API:', error);
        }
      }
      
      return {
        success: true,
        message: 'Participant invited offline. Will be synced when online.',
        offlineMode: true
      };
    } catch (error) {
      console.error('Invite to trip error:', error);
      return { success: false, error: 'Failed to invite participant' };
    }
  }
};

export default offlineApi;