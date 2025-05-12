import NetInfo from '@react-native-community/netinfo';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../apis/api';

/**
 * Simplified SyncService that handles offline/online state
 * without immediately depending on database
 */
class SyncService {
  constructor() {
    this.isOnline = false;
    this.isSyncing = false;
    this.lastSyncTimestamp = null;
    this.syncSubscribers = [];
    this.unsubscribeNetInfo = null;
    this.databaseReady = false;
    this.syncRetryCount = 0;
    this.maxSyncRetries = 3;
  }

  /**
   * Initialize the sync service
   */
  async initialize() {
    try {
      // Load last sync timestamp
      await this.loadLastSyncTimestamp();
      
      // Set up network state listener
      this.unsubscribeNetInfo = NetInfo.addEventListener(state => {
        const wasOnline = this.isOnline;
        if (Platform.OS === 'android') {
          this.isOnline = state.isConnected;
        } else {
          this.isOnline = state.isConnected && state.isInternetReachable;
        }
        
        // Notify subscribers of connection state change
        this.notifySubscribers(this.isOnline ? 'online' : 'offline');
        
        // If we just came online and database is ready, try to sync
        if (!wasOnline && this.isOnline && this.databaseReady) {
          this.syncWithServer();
        }
      });
      
      // Check initial network state
      const state = await NetInfo.fetch();
      if (Platform.OS === 'android') {
        this.isOnline = state.isConnected;
      } else {
        this.isOnline = state.isConnected && state.isInternetReachable;
      }
      
      // Sync if we're online and database is ready
      if (this.isOnline && this.databaseReady) {
        this.syncWithServer();
      }
    } catch (error) {
      console.error('Error initializing SyncService:', error);
      this.databaseReady = false;
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
  }

  /**
   * Load the last sync timestamp from storage
   */
  async loadLastSyncTimestamp() {
    try {
      const timestampStr = await AsyncStorage.getItem('lastSyncTimestamp');
      this.lastSyncTimestamp = timestampStr ? parseInt(timestampStr, 10) : null;
    } catch (error) {
      console.error('Error loading last sync timestamp:', error);
    }
  }

  /**
   * Update the last sync timestamp
   */
  async updateLastSyncTimestamp() {
    try {
      this.lastSyncTimestamp = Date.now();
      await AsyncStorage.setItem('lastSyncTimestamp', this.lastSyncTimestamp.toString());
    } catch (error) {
      console.error('Error updating last sync timestamp:', error);
    }
  }

  /**
   * Subscribe to sync events
   * @param {Function} callback Callback function to be called on sync events
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.syncSubscribers.push(callback);
    return () => {
      this.syncSubscribers = this.syncSubscribers.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all subscribers of an event
   * @param {string} status Status to notify subscribers of
   * @param {any} progress Optional progress information
   */
  notifySubscribers(status, progress = null) {
    this.syncSubscribers.forEach(cb => {
      try {
        cb(status, progress);
      } catch (error) {
        console.error('Error in sync subscriber callback:', error);
      }
    });
  }

  /**
   * Sync with the server
   * This is a placeholder that will be replaced when the database is ready
   */
  async syncWithServer() {
    if (this.isSyncing || !this.isOnline || !this.databaseReady) {
      return;
    }
    
    this.isSyncing = true;
    this.notifySubscribers('started');
    
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Reset retry count on successful sync start
      this.syncRetryCount = 0;

      // Perform sync operations
      await this.performSync();

      // Update last sync timestamp
      this.lastSyncTimestamp = Date.now();
      await AsyncStorage.setItem('lastSyncTimestamp', this.lastSyncTimestamp.toString());
      
      this.notifySubscribers('completed');
    } catch (error) {
      console.error('Sync error:', error);
      
      // Implement retry logic
      if (this.syncRetryCount < this.maxSyncRetries) {
        this.syncRetryCount++;
        console.log(`Retrying sync (attempt ${this.syncRetryCount}/${this.maxSyncRetries})...`);
        
        // Wait for 5 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
        this.isSyncing = false;
        this.syncWithServer();
      } else {
        this.notifySubscribers('failed', error.message);
      }
    } finally {
      if (this.syncRetryCount >= this.maxSyncRetries) {
        this.isSyncing = false;
      }
    }
  }

  async performSync() {
    try {
      // Get the OfflineService instance
      const offlineService = require('./OfflineService').default;
      
      // Sync all data types
      await offlineService.syncTrips();
      await offlineService.syncParticipants();
      await offlineService.syncItineraryItems();
      await offlineService.syncMessages();
      await offlineService.syncExpenses();
      await offlineService.syncDocuments();
      
      // Update last sync timestamp
      await this.updateLastSyncTimestamp();
    } catch (error) {
      console.error('Error in performSync:', error);
      throw error;
    }
  }

  /**
   * Manually trigger a sync
   */
  manualSync() {
    if (!this.isOnline) {
      Alert.alert('Offline Mode', 'You are currently offline. Your changes will sync automatically when you reconnect to the internet.', [{ text: 'OK' }]);
      return;
    }
    
    if (this.isSyncing) {
      Alert.alert('Sync in Progress', 'Data synchronization is already in progress.', [{ text: 'OK' }]);
      return;
    }
    
    this.syncWithServer();
  }

  /**
   * Get the current sync status
   * @returns {Object} Current sync status
   */
  getStatus() {
    return { 
      isOnline: this.isOnline, 
      isSyncing: this.isSyncing, 
      lastSync: this.lastSyncTimestamp ? new Date(this.lastSyncTimestamp) : null 
    };
  }
}

const syncService = new SyncService();
export default syncService;