import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import { PERMISSIONS, RESULTS, requestMultiple, check } from 'react-native-permissions';
import RNFS from 'react-native-fs';

class PermissionService {
  constructor() {
    this.storagePath = null;
  }

  async requestStoragePermission() {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          // Android 13+ uses granular media permissions
          const permissions = [
            PERMISSIONS.ANDROID.READ_MEDIA_IMAGES,
            PERMISSIONS.ANDROID.READ_MEDIA_VIDEO,
            PERMISSIONS.ANDROID.READ_MEDIA_AUDIO
          ];
          
          const results = await requestMultiple(permissions);
          const allGranted = Object.values(results).every(
            result => result === RESULTS.GRANTED
          );

          if (allGranted) {
            await this.setupStoragePath();
            return true;
          }
        } else {
          // Android 12 and below uses legacy storage permissions
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            {
              title: "Storage Permission",
              message: "TripSync needs access to storage to save files for offline use.",
              buttonNeutral: "Ask Me Later",
              buttonNegative: "Cancel",
              buttonPositive: "OK"
            }
          );

          if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            await this.setupStoragePath();
            return true;
          }
        }

        // If permissions were denied
        Alert.alert(
          'Permission Required',
          'Storage access is required for offline functionality. Please grant the permissions in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: () => Linking.openSettings() 
            }
          ]
        );
        return false;
      } else if (Platform.OS === 'ios') {
        // iOS uses photo library permission
        const result = await requestMultiple([PERMISSIONS.IOS.PHOTO_LIBRARY]);
        if (result[PERMISSIONS.IOS.PHOTO_LIBRARY] === RESULTS.GRANTED) {
          await this.setupStoragePath();
          return true;
        }
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error requesting storage permission:', error);
      return false;
    }
  }

  async setupStoragePath() {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          // For Android 13+, use app-specific directory
          this.storagePath = `${RNFS.DocumentDirectoryPath}/TripSync`;
        } else {
          // For Android 12 and below, use external storage
          this.storagePath = `${RNFS.ExternalDirectoryPath}/TripSync`;
        }
      } else if (Platform.OS === 'ios') {
        // iOS uses app's documents directory
        this.storagePath = `${RNFS.DocumentDirectoryPath}/TripSync`;
      }

      // Create directory if it doesn't exist
      const exists = await RNFS.exists(this.storagePath);
      if (!exists) {
        await RNFS.mkdir(this.storagePath);
      }

      return this.storagePath;
    } catch (error) {
      console.error('Error setting up storage path:', error);
      return null;
    }
  }

  getStoragePath() {
    return this.storagePath;
  }

  async checkStoragePermission() {
    try {
      if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
          const hasImages = await check(PERMISSIONS.ANDROID.READ_MEDIA_IMAGES);
          const hasVideos = await check(PERMISSIONS.ANDROID.READ_MEDIA_VIDEO);
          return hasImages === RESULTS.GRANTED && hasVideos === RESULTS.GRANTED;
        } else {
          const hasWrite = await check(PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE);
          return hasWrite === RESULTS.GRANTED;
        }
      } else if (Platform.OS === 'ios') {
        const hasPhotos = await check(PERMISSIONS.IOS.PHOTO_LIBRARY);
        return hasPhotos === RESULTS.GRANTED;
      }
      return true;
    } catch (error) {
      console.error('Error checking storage permission:', error);
      return false;
    }
  }
}

export default new PermissionService(); 