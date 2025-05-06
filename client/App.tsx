import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { Linking, AppState, AppStateStatus } from 'react-native';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
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

import CustomDrawerContent from './src/components/CustomDrawerContent';

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Invitation: { tripId: string, email: string };
  DrawerNav: undefined;
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['tripsync://', 'https://tripsync.app'],
  config: {
    screens: {
      Login: 'login',
      Register: 'register',
      Invitation: {
        path: 'invite',
        parse: {
          tripId: (tripId: string): string => tripId,
          email: (email: string): string => decodeURIComponent(email)
        }
      },
      DrawerNav: 'app'
    }
  }
};

const TripsStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TripsMain" component={TripsScreen} />
      <Stack.Screen name="TripDetails" component={TripDetailsScreen} />
      <Stack.Screen name="CreateTrip" component={CreateTripScreen} />
      <Stack.Screen name="InviteParticipants" component={InviteParticipantsScreen} />
      <Stack.Screen name="Itinerary" component={ItineraryScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Billing" component={BillingScreen} />
      <Stack.Screen name="ImageViewer" component={ImageViewerScreen} />
      <Stack.Screen name="LocationViewer" component={LocationViewerScreen} />
    </Stack.Navigator>
  );
};

const DrawerNavigation = () => {
  return (
    <Drawer.Navigator 
      initialRouteName="Dashboard"
      drawerContent={props => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false, 
      }}
    >
      <Drawer.Screen name="Dashboard" component={DashboardScreen} />
      <Drawer.Screen name="Trips" component={TripsStack} />
    </Drawer.Navigator>
  );
};

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkToken();

    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('App opened with initial URL:', url);
      }
    }).catch(err => console.error('An error occurred getting initial URL', err));

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkToken();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    const authCheckInterval = setInterval(checkToken, 1000);

    return () => {
      subscription.remove();
      clearInterval(authCheckInterval);
    };
  }, []);
  
  const handleDeepLink = (event: { url: string }) => {
    const { url } = event;
    console.log('Deep link received:', url);
  };

  const checkToken = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      setIsLoggedIn(!!token);
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
      <NavigationContainer linking={linking}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {isLoggedIn ? (
            <Stack.Screen name="DrawerNav" component={DrawerNavigation} />
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Invitation" component={InvitationHandlerScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
};

export default App;