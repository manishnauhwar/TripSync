import { getMessaging, getToken, onMessage, onTokenRefresh, getInitialNotification, onNotificationOpenedApp, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import api from '../apis/api';
import { navigate } from '../apis/navigationRef';
import notifee from '@notifee/react-native';

class NotificationService {
  constructor() {
    this.isInitialized = false;
    this.unsubscribers = [];
    this.channelId = null;
  }

  async createNotificationChannel() {
    if (Platform.OS === 'android') {
      // Create a channel
      this.channelId = await notifee.createChannel({
        id: 'tripsync_default_channel',
        name: 'TripSync Notifications',
        lights: true,
        vibration: true,
        importance: 4, // High importance for heads-up notifications
      });
      console.log('Notification channel created:', this.channelId);
    }
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Create notification channel first
      await this.createNotificationChannel();
      
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
            // Even without permission, continue with token retrieval
            // as we may still be able to receive notifications when app is in foreground
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

  async showLocalNotification(remoteMessage) {
    if (!remoteMessage) return;
    
    try {
      if (Platform.OS === 'android') {
        // For Android, we need to display the notification manually when in foreground
        const notification = remoteMessage.notification || {};
        const data = remoteMessage.data || {};
        
        // Use notifee to display the notification
        await notifee.displayNotification({
          title: notification.title || 'TripSync Notification',
          body: notification.body || '',
          android: {
            channelId: 'tripsync_default_channel',
            smallIcon: 'ic_notification', // Make sure this matches your resource name
            color: '#6200ea', // Make sure this matches your notification_color
            priority: 'high',
            pressAction: {
              id: 'default',
            },
          },
          data,
        });
      } else if (Platform.OS === 'ios') {
        // For iOS, use Alert for foreground notifications
        Alert.alert(
          remoteMessage.notification?.title || 'Notification',
          remoteMessage.notification?.body,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error showing local notification:', error);
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
        } else if (type === 'document') {
          navigate('Trips', {
            screen: 'TripDetails',
            params: {
              tripId,
              initialTab: 'documents'
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