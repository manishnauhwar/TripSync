import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Card, Button, FAB } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { runOnJS } from 'react-native-reanimated';
import api from '../apis/api';
import 'react-native-reanimated';

const DashboardScreen = () => {
  const navigation = useNavigation();
  const [username, setUsername] = useState('');
  const [recentTrips, setRecentTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
      fetchRecentTrips();
      return () => {};
    }, [])
  );

  const fetchUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('userDetails');
      if (userData) {
        const parsed = JSON.parse(userData);
        setUsername(parsed.username || 'User');
      }
    } catch (error) {
      console.log('Error fetching user data:', error);
    }
  };

  const fetchRecentTrips = async () => {
    setLoading(true);
    try {
      const response = await api.getTrips();
      if (response.success) {
        const sortedTrips = response.data.data
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 5);
        setRecentTrips(sortedTrips);
        setError(null);
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Failed to fetch trips');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrip = () => {
    navigation.navigate('Trips', { screen: 'CreateTrip' });
  };

  const handleViewAllTrips = () => {
    navigation.navigate('Trips', { screen: 'TripsMain' });
  };

  const handleViewTrip = (tripId) => {
    navigation.navigate('Trips', { screen: 'TripDetails', params: { tripId } });
  };

  const openDrawer = () => {
    requestAnimationFrame(() => {
      navigation.openDrawer();
    });
  };

  const renderTripCard = ({ item }) => (
    <TouchableOpacity onPress={() => handleViewTrip(item._id)}>
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.tripName}>{item.name}</Text>
          <Text style={styles.tripDescription}>{item.description || 'No description'}</Text>
          <Text style={styles.participantsText}>
            {item.participants.length} participant{item.participants.length !== 1 ? 's' : ''}
          </Text>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header>
        <Appbar.Action icon="menu" onPress={openDrawer} />
        <Appbar.Content title="Dashboard" />
      </Appbar.Header>

      <View style={styles.contentContainer}>
        <Text style={styles.welcomeText}>Welcome, {username}!</Text>
        <Text style={styles.subtitle}>Create trips and invite friends to collaborate</Text>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Trips</Text>
          {recentTrips.length > 0 && (
            <TouchableOpacity onPress={handleViewAllTrips}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#6200ea" style={styles.loader} />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Button mode="contained" onPress={fetchRecentTrips}>Retry</Button>
          </View>
        ) : recentTrips.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>You don't have any trips yet</Text>
            <Button 
              mode="contained" 
              icon="plus" 
              onPress={handleCreateTrip}
              style={styles.createButton}
            >
              Create Your First Trip
            </Button>
          </View>
        ) : (
          <FlatList
            data={recentTrips}
            renderItem={renderTripCard}
            keyExtractor={item => item._id}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </View>

      <FAB
        style={styles.fab}
        icon="plus"
        onPress={handleCreateTrip}
        color="#fff"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewAllText: {
    color: '#6200ea',
    fontWeight: 'bold',
  },
  card: {
    marginBottom: 12,
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
  listContainer: {
    paddingBottom: 80,
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
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#6200ea',
    paddingHorizontal: 16,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
    marginBottom: 16,
  },
  loader: {
    marginTop: 20,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#6200ea',
  },
});

export default DashboardScreen;
