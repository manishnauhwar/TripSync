import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Platform, BackHandler, Linking } from 'react-native';
import { Appbar, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';

const LocationViewerScreen = ({ route, navigation }) => {
  const [locationData, setLocationData] = useState(null);
  const [error, setError] = useState(null);

  // Handle back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => backHandler.remove();
  }, [navigation]);

  // Process location data
  useEffect(() => {
    const { latitude, longitude, title = 'Shared Location' } = route.params || {};
    console.log('Location params:', { latitude, longitude, title });

    const lat = Number(latitude);
    const lon = Number(longitude);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      console.error('Invalid coordinates:', { lat, lon });
      setError('Invalid location data.');
      return;
    }

    setLocationData({ latitude: lat, longitude: lon, title });
  }, [route.params]);

  // Open location in maps app
  const openInMapsApp = () => {
    if (!locationData) return;

    const { latitude, longitude, title } = locationData;
    const url = Platform.select({
      ios: `maps:?q=${encodeURIComponent(title)}&ll=${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}(${encodeURIComponent(title)})`
    });

    Linking.openURL(url).catch((err) => {
      console.error('Error opening maps:', err);
      setError('Could not open maps app.');
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Location" />
      </Appbar.Header>

      <View style={styles.content}>
        {!locationData && !error ? (
          <ActivityIndicator size="large" color="#6200ee" />
        ) : error ? (
          <View style={styles.message}>
            <Text style={styles.errorText}>{error}</Text>
            <Button mode="contained" onPress={() => navigation.goBack()} style={styles.button}>
              Go Back
            </Button>
          </View>
        ) : (
          <View style={styles.locationInfo}>
            <Text style={styles.title}>{locationData.title}</Text>
            <MapView
              style={styles.map}
              initialRegion={{
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              onError={(e) => {
                console.error('Map error:', e);
                setError('Failed to load map.');
              }}
            >
              <Marker
                coordinate={{ latitude: locationData.latitude, longitude: locationData.longitude }}
                title={locationData.title}
              />
            </MapView>
            <View style={styles.coords}>
              <Text style={styles.coordText}>Lat: {locationData.latitude.toFixed(6)}</Text>
              <Text style={styles.coordText}>Lon: {locationData.longitude.toFixed(6)}</Text>
            </View>
            <Button mode="contained" icon="map" onPress={openInMapsApp} style={styles.button}>
              Open in Maps
            </Button>
            <Button mode="outlined" onPress={() => navigation.goBack()} style={styles.button}>
              Back
            </Button>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' },
  message: { alignItems: 'center', padding: 16 },
  errorText: { fontSize: 16, color: '#d32f2f', marginBottom: 16, textAlign: 'center' },
  locationInfo: {
    width: '100%',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  map: { width: '100%', height: 200, borderRadius: 8, marginBottom: 12 },
  coords: { backgroundColor: '#f0f0f0', padding: 12, borderRadius: 6, width: '100%', marginBottom: 12 },
  coordText: { fontSize: 14, marginVertical: 2 },
  button: { width: '100%', marginVertical: 4, padding: 4 },
});

export default LocationViewerScreen;