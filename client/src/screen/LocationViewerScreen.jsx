import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
  PermissionsAndroid,
  Text,
  useColorScheme,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Button } from 'react-native-paper';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { LinearGradient } from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImageBackground } from 'react-native';

const { width, height } = Dimensions.get('window');

const LocationViewerScreen = ({ navigation, route }) => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [tripDetails, setTripDetails] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const mapRef = React.useRef(null);
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const [locationMethod, setLocationMethod] = useState('gps');
  const [locationAttempts, setLocationAttempts] = useState(0);
  const MAX_ATTEMPTS = 3;

  const theme = {
    background: isDarkMode ? 'rgba(18, 18, 18, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    text: isDarkMode ? '#FFFFFF' : '#333333',
    cardBackground: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    subtext: isDarkMode ? '#AAAAAA' : '#666666',
    primary: '#2E7D32',
    accent: '#03DAC6',
    error: '#CF6679',
    divider: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
  };

  useEffect(() => {
    const initializeLocation = async () => {
      await loadUserData();
      await loadTripDetails();
      const servicesEnabled = await checkLocationServices();
      if (servicesEnabled) {
        await requestLocationPermission();
      }
    };

    initializeLocation();

    return () => {
      if (watchId) {
        Geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const loadTripDetails = () => {
    const { tripId, tripName } = route.params || {};
    if (!tripId) {
      setError('Trip information not found');
      setLoading(false);
      return;
    }
    setTripDetails({ tripId, tripName });
  };

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('userDetails');
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      } else {
        setError('User data not found');
        setLoading(false);
      }
    } catch (err) {
      console.error('Error loading user data:', err);
      setError('Failed to load user data');
      setLoading(false);
    }
  };

  const getLocationWithFallback = () => {
    setLoading(true);
    setError(null);
    setLocationAttempts(prev => prev + 1);

    // First try with high accuracy
    Geolocation.getCurrentPosition(
      (position) => {
        handleLocationSuccess(position);
      },
      (error) => {
        console.log('High accuracy location failed, trying network location...');
        // If high accuracy fails, try with network location
        Geolocation.getCurrentPosition(
          (position) => {
            handleLocationSuccess(position);
          },
          (error) => {
            console.log('Network location failed, trying last known location...');
            // If network location fails, try to get last known location
            Geolocation.getLastKnownPosition(
              (position) => {
                handleLocationSuccess(position);
              },
              (error) => {
                handleLocationError(error);
              },
              {
                timeout: 5000,
                maximumAge: 300000, // 5 minutes
                enableHighAccuracy: false
              }
            );
          },
          {
            timeout: 10000,
            maximumAge: 300000, // 5 minutes
            enableHighAccuracy: false
          }
        );
      },
      {
        timeout: 10000,
        maximumAge: 0,
        enableHighAccuracy: true
      }
    );
  };

  const handleLocationSuccess = (position) => {
    const { latitude, longitude, accuracy } = position.coords;
    console.log('Location obtained:', { 
      latitude, 
      longitude, 
      accuracy,
      method: locationMethod 
    });
    
    setCurrentLocation({ latitude, longitude });
    setLoading(false);
    
    // Update map if available
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    }
  };

  const handleLocationError = (error) => {
    console.error('Location error:', error);
    let errorMessage = '';
    
    if (error.code === 1) {
      errorMessage = 'Location permission denied. Please enable location services in your device settings.';
    } else if (error.code === 2) {
      errorMessage = 'Location services are disabled. Please enable GPS in your device settings.';
    } else if (error.code === 3) {
      if (locationAttempts < MAX_ATTEMPTS) {
        // Retry with different settings
        setTimeout(() => {
          getLocationWithFallback();
        }, 2000);
        return;
      }
      errorMessage = 'Location request timed out. Please check your internet connection and try again.';
    } else {
      errorMessage = 'Unable to get location. Please check your device settings and try again.';
    }
    
    setError(errorMessage);
    setLoading(false);
  };

  const requestLocationPermission = async () => {
    try {
      if (Platform.OS === 'ios') {
        const auth = await Geolocation.requestAuthorization('whenInUse');
        if (auth === 'granted') {
          setHasPermission(true);
          setTimeout(() => {
            getLocationWithFallback();
            startWatchingLocation();
          }, 1000);
        } else {
          setError('Location permission denied. Please enable in Settings.');
          setLoading(false);
        }
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Location Permission",
            message: "TripSync needs access to your location to share it in chat.",
            buttonNeutral: "Ask Me Later",
            buttonNegative: "Cancel",
            buttonPositive: "OK"
          }
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          setHasPermission(true);
          setTimeout(() => {
            getLocationWithFallback();
            startWatchingLocation();
          }, 1000);
        } else {
          setError('Location permission denied. Please enable in Settings.');
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('Permission request error:', err);
      setError('Failed to request location permission. Please try again.');
      setLoading(false);
    }
  };

  const getCurrentLocation = () => {
    setLocationAttempts(0);
    getLocationWithFallback();
  };

  const startWatchingLocation = () => {
    if (watchId) {
      Geolocation.clearWatch(watchId);
    }

    const newWatchId = Geolocation.watchPosition(
      (position) => {
        handleLocationSuccess(position);
      },
      (error) => {
        handleLocationError(error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 5,
        interval: 3000,
        fastestInterval: 1000,
        timeout: 15000,
        maximumAge: 10000
      }
    );

    setWatchId(newWatchId);
  };

  const checkLocationServices = async () => {
    try {
      if (Platform.OS === 'android') {
        const enabled = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if (!enabled) {
          setError('Location services are disabled. Please enable GPS in your device settings.');
          setLoading(false);
          return false;
        }
      }
      return true;
    } catch (err) {
      console.error('Error checking location services:', err);
      setError('Unable to check location services. Please try again.');
      setLoading(false);
      return false;
    }
  };

  const handleShareLocation = () => {
    if (!currentLocation) {
      Alert.alert('Error', 'Unable to get current location');
      return;
    }

    if (!currentUser) {
      Alert.alert('Error', 'User data not found. Please try again.');
      return;
    }

    if (!tripDetails?.tripId) {
      Alert.alert('Error', 'Trip information not found. Please try again.');
      return;
    }

    const locationData = {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude
    };

    console.log('Sharing location:', locationData);
    console.log('Current user:', currentUser);
    console.log('Trip details:', tripDetails);

    const formattedUser = {
      _id: currentUser.id || currentUser._id,
      username: currentUser.username,
      fullName: currentUser.fullName,
      email: currentUser.email
    };

    navigation.navigate('Chat', {
      location: locationData,
      screen: 'Chat',
      user: formattedUser,
      tripId: tripDetails.tripId,
      tripName: tripDetails.tripName || 'Trip Chat'
    });
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.text }]}>Getting your location...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={[styles.errorContainer, { backgroundColor: theme.background }]}>
          <Text style={[styles.errorText, { color: theme.text }]}>{error}</Text>
          <Button 
            mode="contained" 
            onPress={requestLocationPermission}
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            labelStyle={{ color: '#fff' }}
          >
            Grant Permission
          </Button>
        </View>
      );
    }

    if (!currentLocation) {
      return (
        <View style={[styles.errorContainer, { backgroundColor: theme.background }]}>
          <Text style={[styles.errorText, { color: theme.text }]}>Location not available</Text>
          <Button 
            mode="contained" 
            onPress={getCurrentLocation}
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            labelStyle={{ color: '#fff' }}
          >
            Retry
          </Button>
        </View>
      );
    }

    return (
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        showsUserLocation={true}
        showsMyLocationButton={true}
        followsUserLocation={true}
        showsCompass={true}
        showsScale={true}
        showsTraffic={false}
        showsBuildings={true}
        showsIndoors={true}
        showsPointsOfInterest={true}
        customMapStyle={isDarkMode ? darkMapStyle : []}
      >
        <Marker
          coordinate={{
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          }}
          title="Your Location"
          description="This is your current location"
          pinColor={theme.primary}
        />
      </MapView>
    );
  };

  return (
    <ImageBackground
      source={require('../assets/images/1.jpg')}
      style={styles.backgroundImage}
    >
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <SafeAreaView style={styles.container}>
        <Appbar.Header style={[styles.appbar, { backgroundColor: 'transparent' }]}>
          <Appbar.BackAction color="#fff" onPress={() => navigation.goBack()} />
          <Appbar.Content 
            title="Share Location" 
            titleStyle={[styles.appbarTitle, { color: '#fff' }]} 
          />
        </Appbar.Header>

        <View style={[styles.mapContainer, { backgroundColor: theme.background }]}>
          {renderContent()}
        </View>

        <View style={[styles.buttonContainer, { backgroundColor: theme.cardBackground }]}>
          <LinearGradient
            colors={[theme.primary, theme.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Button
              mode="contained"
              onPress={handleShareLocation}
              style={styles.shareButton}
              labelStyle={styles.buttonLabel}
              disabled={loading || !!error || !currentLocation || !currentUser || !tripDetails?.tripId}
            >
              Share Current Location
            </Button>
          </LinearGradient>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
};

const darkMapStyle = [
  {
    "elementType": "geometry",
    "stylers": [{ "color": "#242f3e" }]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#746855" }]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#242f3e" }]
  },
  {
    "featureType": "administrative.locality",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#d59563" }]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#d59563" }]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [{ "color": "#263c3f" }]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#6b9a76" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [{ "color": "#38414e" }]
  },
  {
    "featureType": "road",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#212a37" }]
  },
  {
    "featureType": "road",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#9ca5b3" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [{ "color": "#746855" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry.stroke",
    "stylers": [{ "color": "#1f2835" }]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#f3d19c" }]
  },
  {
    "featureType": "transit",
    "elementType": "geometry",
    "stylers": [{ "color": "#2f3948" }]
  },
  {
    "featureType": "transit.station",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#d59563" }]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [{ "color": "#17263c" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [{ "color": "#515c6d" }]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.stroke",
    "stylers": [{ "color": "#17263c" }]
  }
];

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
  },
  appbar: {
    elevation: 0,
  },
  appbarTitle: {
    fontWeight: 'bold',
  },
  mapContainer: {
    flex: 1,
    margin: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  map: {
    width: width,
    height: height - 180,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    padding: 16,
    margin: 10,
    borderRadius: 20,
  },
  buttonGradient: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  shareButton: {
    backgroundColor: 'transparent',
    elevation: 0,
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 10,
  },
});

export default LocationViewerScreen; 