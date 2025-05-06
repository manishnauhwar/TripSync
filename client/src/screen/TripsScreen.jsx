import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Card, Banner } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import api from '../apis/api';
import offlineApi from '../apis/offlineApi';
import useSync from '../hooks/useSync';

const TripsScreen = () => {
  const navigation = useNavigation();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const { isOnline } = useSync();

  useFocusEffect(
    useCallback(() => {
      fetchTrips();
      return () => {};
    }, [isOnline]) // Re-fetch when online status changes
  );

  const fetchTrips = async () => {
    setLoading(true);
    try {
      console.log('Fetching trips...');
      
      // Use offlineApi which handles both online and offline scenarios
      const response = await offlineApi.getTrips();
      console.log('Trips API response:', response);
      
      if (response.success) {
        // Handle null data
        const tripsData = response.data || [];
        
        // If it's an array, use it directly; if it's an object with data property, use that
        const tripsArray = Array.isArray(tripsData) ? tripsData : 
                         (tripsData.data && Array.isArray(tripsData.data)) ? tripsData.data : [];
        
        setTrips(tripsArray);
        setOfflineMode(!!response.offlineMode);
        setError(null);
      } else {
        console.error('Error fetching trips:', response.error);
        setError(response.error || 'Failed to fetch trips');
        setTrips([]);
      }
    } catch (err) {
      console.error('Exception fetching trips:', err);
      setError('Failed to fetch trips. Please check your connection.');
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrip = () => {
    navigation.navigate('Trips', { screen: 'CreateTrip' });
  };

  const openDrawer = () => {
    requestAnimationFrame(() => {
      navigation.openDrawer();
    });
  };

  const renderTripCard = ({ item }) => (
    <TouchableOpacity 
      onPress={() => navigation.navigate('Trips', { screen: 'TripDetails', params: { tripId: item._id } })}
    >
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.tripName}>{item.name}</Text>
          <Text style={styles.tripDescription}>{item.description || 'No description'}</Text>
          <Text style={styles.participantsText}>
            {item.participants ? `${item.participants.length} participant${item.participants.length !== 1 ? 's' : ''}` : '0 participants'}
          </Text>
          {item.offlineRecord && (
            <Text style={styles.offlineIndicator}>Not yet synced</Text>
          )}
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header>
        <Appbar.Action icon="menu" onPress={openDrawer} />
        <Appbar.Content title="My Trips" />
        <Appbar.Action icon="plus" onPress={handleCreateTrip} />
      </Appbar.Header>

      <Banner
        visible={offlineMode}
        actions={[
          {
            label: 'Refresh',
            onPress: fetchTrips,
          },
        ]}
        icon="wifi-off"
      >
        You're viewing offline data. Some features may be limited.
      </Banner>

      {loading ? (
        <ActivityIndicator size="large" color="#6200ea" style={styles.loader} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchTrips}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>You don't have any trips yet</Text>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateTrip}>
            <Text style={styles.createButtonText}>Create a Trip</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={trips}
          renderItem={renderTripCard}
          keyExtractor={item => item._id || Math.random().toString()}
          contentContainerStyle={styles.listContainer}
          onRefresh={fetchTrips}
          refreshing={loading}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  card: {
    marginBottom: 10,
    elevation: 2,
  },
  tripName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tripDescription: {
    color: '#666',
    marginVertical: 5,
  },
  participantsText: {
    color: '#0066cc',
    fontSize: 12,
  },
  offlineIndicator: {
    color: '#ff9800',
    fontSize: 12,
    marginTop: 4,
  },
  listContainer: {
    padding: 16,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginBottom: 15,
  },
  retryButton: {
    backgroundColor: '#6200ea',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryText: {
    color: 'white',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  createButton: {
    backgroundColor: '#6200ea',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  createButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default TripsScreen; 