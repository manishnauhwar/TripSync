import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import syncService from '../services/SyncService';

export const useSync = () => {
  const [syncStatus, setSyncStatus] = useState({
    isOnline: false,
    isSyncing: false,
    lastSync: null
  });

  useEffect(() => {
    // Get initial status safely
    try {
      const initialStatus = syncService.getStatus();
      setSyncStatus(initialStatus);
    } catch (error) {
      console.error('Error getting initial sync status:', error);
    }

    // Subscribe to sync events with error handling
    let unsubscribe = () => {};
    try {
      unsubscribe = syncService.subscribe((event, progress) => {
        try {
          if (event === 'online' || event === 'offline') {
            setSyncStatus(prev => ({ 
              ...prev, 
              isOnline: event === 'online' 
            }));
          } else if (event === 'started') {
            setSyncStatus(prev => ({ ...prev, isSyncing: true }));
          } else if (event === 'completed') {
            setSyncStatus({
              isOnline: syncService.getStatus().isOnline,
              isSyncing: false,
              lastSync: new Date()
            });
          } else if (event === 'failed') {
            setSyncStatus(prev => ({
              ...prev,
              isSyncing: false,
            }));
          }
        } catch (eventError) {
          console.error('Error processing sync event:', eventError);
        }
      });
    } catch (error) {
      console.error('Error subscribing to sync events:', error);
    }

    // Monitor network status independently as a fallback
    const netInfoUnsubscribe = NetInfo.addEventListener(state => {
      try {
        const isConnected = state.isConnected;
        setSyncStatus(prev => {
          if (prev.isOnline !== isConnected) {
            return { ...prev, isOnline: isConnected };
          }
          return prev;
        });
      } catch (error) {
        console.error('Error handling NetInfo event:', error);
      }
    });

    // Periodic status check as an additional safety measure
    const checkOnlineInterval = setInterval(() => {
      try {
        NetInfo.fetch().then(state => {
          setSyncStatus(prev => ({
            ...prev,
            isOnline: state.isConnected
          }));
        }).catch(error => {
          console.error('Error fetching network status:', error);
        });
      } catch (error) {
        console.error('Error in periodic network check:', error);
      }
    }, 10000);

    return () => {
      try {
        unsubscribe();
        netInfoUnsubscribe();
        clearInterval(checkOnlineInterval);
      } catch (error) {
        console.error('Error cleaning up useSync hook:', error);
      }
    };
  }, []);

  const manualSync = () => {
    try {
      syncService.manualSync();
    } catch (error) {
      console.error('Error triggering manual sync:', error);
    }
  };

  return {
    ...syncStatus,
    manualSync,
  };
};

export default useSync; 