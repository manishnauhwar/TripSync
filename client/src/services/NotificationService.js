import { getMessaging, getToken, onMessage, onTokenRefresh, getInitialNotification, onNotificationOpenedApp, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import api from '../apis/api';
import { navigate } from '../apis/navigationRef';

class NotificationService {
  constructor() {
    this.isInitialized = false;
    this.unsubscribers = [];
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      if (Platform.OS === 'ios') {
        const authStatus = await getMessaging().requestPermission();
        const enabled =
          authStatus === getMessaging().AuthorizationStatus.AUTHORIZED ||
          authStatus === getMessaging().AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
          console.log('Notification permissions denied');
          return;
        }
      } else if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.log('Notification permissions denied');
          }
        } catch (err) {
          console.log('Error requesting Android notification permission:', err);
        }
      }
      
      const fcmToken = await getToken(getMessaging());
      console.log('FCM Token obtained:', fcmToken ? 'Success' : 'Failed');
      
      if (fcmToken) {
        await this.registerTokenWithServer(fcmToken);
      }
      
      const tokenRefreshUnsubscribe = onTokenRefresh(getMessaging(), async newToken => {
        console.log('FCM token refreshed');
        await this.registerTokenWithServer(newToken);
      });
      this.unsubscribers.push(tokenRefreshUnsubscribe);
      
      const messageUnsubscribe = onMessage(getMessaging(), async remoteMessage => {
        console.log('Foreground notification received:', remoteMessage);
        this.showLocalNotification(remoteMessage);
      });
      this.unsubscribers.push(messageUnsubscribe);
      
      this.setupBackgroundHandler();
      this.setupNotificationTapHandler();

      this.isInitialized = true;
      console.log('Notification service initialized successfully');
    } catch (error) {
      console.error('Error initializing notification service:', error);
    }
  }

  setupBackgroundHandler() {
    setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
      console.log('Background message received:', remoteMessage);
      return Promise.resolve();
    });
  }

  setupNotificationTapHandler() {
    getInitialNotification(getMessaging()).then(remoteMessage => {
      if (remoteMessage) {
        console.log('App opened from notification:', remoteMessage);
        this.handleNotificationTap(remoteMessage);
      }
    });
    
    const notificationOpenedUnsubscribe = onNotificationOpenedApp(getMessaging(), remoteMessage => {
      console.log('Notification tapped in background:', remoteMessage);
      this.handleNotificationTap(remoteMessage);
    });
    this.unsubscribers.push(notificationOpenedUnsubscribe);
  }

  async registerTokenWithServer(fcmToken) {
    try {
      const deviceId = await DeviceInfo.getUniqueId();
      const platform = Platform.OS;
      const isLoggedIn = !!(await AsyncStorage.getItem('token'));

      if (isLoggedIn) {
        await api.registerDevice(deviceId, fcmToken, platform);
        console.log('Device registered with server successfully');
        await AsyncStorage.setItem('fcmToken', fcmToken);
      } else {
        await AsyncStorage.setItem('fcmToken', fcmToken);
        await AsyncStorage.setItem('deviceId', deviceId);
        console.log('FCM token saved locally for later registration');
      }
    } catch (error) {
      console.error('Error registering FCM token with server:', error);
    }
  }

  showLocalNotification(remoteMessage) {
    if (!remoteMessage || !remoteMessage.notification) return;
    
    if (Platform.OS === 'android') {
      console.log('Android notification will be shown automatically');
    } else if (Platform.OS === 'ios') {
      Alert.alert(
        remoteMessage.notification.title || 'Notification',
        remoteMessage.notification.body,
        [{ text: 'OK' }]
      );
    }
  }

  async sendTestNotification() {
    try {
      const fcmToken = await AsyncStorage.getItem('fcmToken');
      if (!fcmToken) {
        console.log('No FCM token available for test notification');
        return;
      }
      
      console.log('Sending test notification to server...');
      const response = await api.sendTestNotification(fcmToken);
      console.log('Test notification response:', response);
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  }

  handleNotificationTap(remoteMessage) {
    try {
      if (!remoteMessage || !remoteMessage.data) return;

      const { tripId, type } = remoteMessage.data;

      if (tripId) {
        if (type === 'chat') {
          navigate('Trips', {
            screen: 'TripDetails',
            params: {
              tripId,
              initialTab: 'chat'
            }
          });
        } else if (type === 'itinerary_update' || type === 'itinerary_reminder') {
          navigate('Trips', {
            screen: 'TripDetails',
            params: {
              tripId,
              initialTab: 'itinerary'
            }
          });
        } else {
          navigate('Trips', {
            screen: 'TripDetails',
            params: { tripId }
          });
        }
      }
    } catch (error) {
      console.error('Error handling notification tap:', error);
    }
  }

  cleanup() {
    this.unsubscribers.forEach(unsubscribe => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
    this.unsubscribers = [];

    this.isInitialized = false;
    console.log('Notification service cleaned up');
  }
}

export default new NotificationService();