import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { Linking, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Provider as PaperProvider } from 'react-native-paper';

import LoginScreen from './src/screen/LoginScreen';
import RegisterScreen from './src/screen/RegisterScreen';
import TripsScreen from './src/screen/TripsScreen';
import CreateTripScreen from './src/screen/CreateTripScreen';
import TripDetailsScreen from './src/screen/TripDetailsScreen';
import InviteParticipantsScreen from './src/screen/InviteParticipantsScreen';
import InvitationHandlerScreen from './src/screen/InvitationHandlerScreen';
import ItineraryScreen from './src/screen/ItineraryScreen';
import ChatScreen from './src/screen/ChatScreen';
import BillingScreen from './src/screen/BillingScreen';
import DashboardScreen from './src/screen/DashboardScreen';
import ImageViewerScreen from './src/screen/ImageViewerScreen';
import LocationViewerScreen from './src/screen/LocationViewerScreen';
import DocumentScreen from './src/screen/DocumentScreen';

import syncService from './src/services/SyncService';
import notificationService from './src/services/NotificationService';
import { navigationRef, processQueuedNavigationActions } from './src/apis/navigationRef';

const Stack = createStackNavigator();

const linking = {
  prefixes: ['tripsync://', 'https://tripsync.app'],
  config: {
    screens: {
      Login: 'login',
      Register: 'register',
      Invitation: {
        path: 'invite/:tripId/:email',
        parse: {
          tripId: (tripId) => tripId,
          email: (email) => decodeURIComponent(email)
        }
      },
      Dashboard: 'app'
    }
  }
};

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [forceUpdate, setForceUpdate] = useState(0);

  useEffect(() => {
    checkToken();

    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    Linking.getInitialURL()
      .then((url) => {
        if (url) {
          console.log('App opened with initial URL:', url);
        }
      })
      .catch(err => console.error('An error occurred getting initial URL', err));

    initializeSyncService();
    initializeNotificationService();

    // Add listener for force update
    const checkForceUpdate = async () => {
      const update = await AsyncStorage.getItem('forceUpdate');
      if (update) {
        setForceUpdate(Number(update));
        await AsyncStorage.removeItem('forceUpdate');
        checkToken();
      }
    };

    const interval = setInterval(checkForceUpdate, 100);

    return () => {
      subscription.remove();
      cleanupSyncService();
      cleanupNotificationService();
      clearInterval(interval);
    };
  }, []);

  const initializeSyncService = () => {
    console.log('Attempting to initialize sync service...');
    try {
      syncService.initialize();
      console.log('Sync service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize sync service:', error);
    }
  };

  const cleanupSyncService = () => {
    console.log('Cleaning up sync service...');
    try {
      syncService.cleanup();
    } catch (error) {
      console.error('Error during sync service cleanup:', error);
    }
  };
  
  const initializeNotificationService = () => {
    console.log('Attempting to initialize notification service...');
    try {
      notificationService.initialize();
      console.log('Notification service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
    }
  };
  
  const cleanupNotificationService = () => {
    console.log('Cleaning up notification service...');
    try {
      notificationService.cleanup();
    } catch (error) {
      console.error('Error during notification service cleanup:', error);
    }
  };

  useEffect(() => {
    const handleAppStateChange = (nextAppState) => {
      if (nextAppState === 'active') {
        checkToken();
        try {
          syncService.syncWithServer();
        } catch (error) {
          console.error('Error syncing when app became active:', error);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    const authCheckInterval = setInterval(checkToken, 30000);

    return () => {
      subscription.remove();
      clearInterval(authCheckInterval);
    };
  }, []);
  
  const handleDeepLink = (event) => {
    const { url } = event;
    console.log('Deep link received:', url);
    
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      
      if (path.startsWith('/invite/')) {
        const parts = path.split('/');
        if (parts.length >= 4) {
          const tripId = parts[2];
          const email = parts[3];
          
          if (isLoggedIn) {
            navigationRef.current?.navigate('Invitation', {
              tripId,
              email
            });
          } else {
            AsyncStorage.setItem('pendingInvitation', JSON.stringify({ tripId, email }))
              .then(() => {
                navigationRef.current?.navigate('Login');
              });
          }
        }
      }
    } catch (error) {
      console.error('Error processing deep link:', error);
    }
  };

  const checkToken = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      setIsLoggedIn(!!token);
      
      if (!!token) {
        const pendingInvitation = await AsyncStorage.getItem('pendingInvitation');
        if (pendingInvitation) {
          const { tripId, email } = JSON.parse(pendingInvitation);
          navigationRef.current?.navigate('Invitation', { tripId, email });
          await AsyncStorage.removeItem('pendingInvitation');
        }
      }
    } catch (error) {
      console.log('Failed to get token', error);
      setIsLoggedIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <PaperProvider>
      <NavigationContainer
        linking={linking}
        ref={navigationRef}
        onReady={() => {
          processQueuedNavigationActions();
        }}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isLoggedIn ? (
            <>
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Dashboard" component={DashboardScreen} />
              <Stack.Screen name="Trips" component={TripsScreen} />
              <Stack.Screen name="TripDetails" component={TripDetailsScreen} />
              <Stack.Screen name="CreateTrip" component={CreateTripScreen} />
              <Stack.Screen name="InviteParticipants" component={InviteParticipantsScreen} />
              <Stack.Screen name="Itinerary" component={ItineraryScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen name="Billing" component={BillingScreen} />
              <Stack.Screen name="ImageViewer" component={ImageViewerScreen} />
              <Stack.Screen name="LocationViewer" component={LocationViewerScreen} />
              <Stack.Screen name="Documents" component={DocumentScreen} />
            </>
          )}
          <Stack.Screen name="Invitation" component={InvitationHandlerScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
};

export default App;