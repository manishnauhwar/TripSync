import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  ImageBackground, 
  StatusBar,
  useColorScheme,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Card, Banner, IconButton } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import api from '../apis/api';
import offlineApi from '../apis/offlineApi';
import useSync from '../hooks/useSync';
import { LinearGradient } from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

const TripsScreen = () => {
  const navigation = useNavigation();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const { isOnline } = useSync();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  // Define theme colors based on light/dark mode
  const theme = {
    background: isDarkMode ? 'rgba(18, 18, 18, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    text: isDarkMode ? '#FFFFFF' : '#333333',
    cardBackground: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    subtext: isDarkMode ? '#AAAAAA' : '#666666',
    primary: '#6200ea',
    accent: '#03DAC6',
    error: '#CF6679',
    divider: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
    offline: isDarkMode ? '#FF9800' : '#FF9800',
  };

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
    navigation.navigate('CreateTrip');
  };

  const goBack = () => {
    navigation.goBack();
  };

  const renderTripCard = ({ item }) => (
    <TouchableOpacity 
      onPress={() => navigation.navigate('TripDetails', { tripId: item._id })}
      style={styles.tripCardContainer}
    >
      <LinearGradient
        colors={['rgba(98, 0, 234, 0.8)', 'rgba(3, 218, 198, 0.8)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.cardGradient}
      >
        <View style={[styles.tripCard, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.tripCardContent}>
            <Text style={[styles.tripName, { color: theme.text }]}>{item.name}</Text>
            <Text style={[styles.tripDescription, { color: theme.subtext }]}>
              {item.description || 'No description'}
            </Text>
            <View style={styles.tripCardFooter}>
              <View style={styles.participantsContainer}>
                <Icon name="account-group" size={16} color={theme.primary} />
                <Text style={[styles.participantsText, { color: theme.primary }]}>
                  {item.participants ? `${item.participants.length} participant${item.participants.length !== 1 ? 's' : ''}` : '0 participants'}
                </Text>
              </View>
              {item.offlineRecord && (
                <View style={styles.offlineContainer}>
                  <Icon name="wifi-off" size={16} color={theme.offline} />
                  <Text style={[styles.offlineIndicator, { color: theme.offline }]}>
                    Not synced
                  </Text>
                </View>
              )}
              <IconButton
                icon="arrow-right"
                size={20}
                color={theme.primary}
                onPress={() => navigation.navigate('TripDetails', { tripId: item._id })}
              />
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <ImageBackground
      source={require('../assets/images/2.jpg')}
      style={styles.backgroundImage}
    >
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <SafeAreaView style={styles.container}>
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <View style={styles.headerContent}>
            <IconButton
              icon="arrow-left"
              size={24}
              color={theme.text}
              onPress={goBack}
              style={styles.backButton}
            />
            <Text style={[styles.headerTitle, { color: theme.text }]}>My Trips</Text>
            <IconButton
              icon="plus"
              size={24}
              color={theme.text}
              onPress={handleCreateTrip}
            />
          </View>
        </View>

        {offlineMode && (
          <View style={[styles.bannerContainer, { backgroundColor: isDarkMode ? 'rgba(25, 25, 25, 0.9)' : 'rgba(255, 240, 205, 0.9)' }]}>
            <Icon name="wifi-off" size={20} color={theme.offline} />
            <Text style={[styles.bannerText, { color: theme.text }]}>
              You're viewing offline data. Some features may be limited.
            </Text>
            <TouchableOpacity onPress={fetchTrips} style={styles.refreshButton}>
              <Text style={[styles.refreshText, { color: theme.primary }]}>Refresh</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.contentContainer}>
          <View style={[styles.contentWrapper, { backgroundColor: theme.background }]}>
            {loading ? (
              <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
                <TouchableOpacity 
                  style={[styles.retryButton, { backgroundColor: theme.primary }]} 
                  onPress={fetchTrips}
                >
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : trips.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="map-search" size={64} color={theme.subtext} style={styles.emptyIcon} />
                <Text style={[styles.emptyText, { color: theme.subtext }]}>You don't have any trips yet</Text>
                <TouchableOpacity 
                  style={[styles.createButton, { backgroundColor: theme.primary }]} 
                  onPress={handleCreateTrip}
                >
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
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 16,
    margin: 16,
    borderRadius: 30,
    // borderBottomLeftRadius: 30,
    // borderBottomRightRadius: 30,
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  backButton: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Roboto',
  },
  bannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
  },
  bannerText: {
    fontSize: 14,
    flex: 1,
    marginLeft: 8,
    fontFamily: 'Roboto',
  },
  refreshButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  refreshText: {
    fontWeight: 'bold',
    fontSize: 14,
    fontFamily: 'Roboto',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  contentWrapper: {
    flex: 1,
    borderRadius: 24,
    padding: 16,
  },
  tripCardContainer: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: 2,
    borderRadius: 16,
  },
  tripCard: {
    borderRadius: 14,
    padding: 16,
  },
  tripCardContent: {
    flex: 1,
  },
  tripName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    fontFamily: 'Roboto',
  },
  tripDescription: {
    marginBottom: 12,
    fontFamily: 'Roboto',
  },
  tripCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantsText: {
    marginLeft: 6,
    fontWeight: '600',
    fontFamily: 'Roboto',
  },
  offlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineIndicator: {
    marginLeft: 4,
    fontSize: 12,
    fontFamily: 'Roboto',
  },
  listContainer: {
    paddingBottom: 16,
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
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Roboto',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    elevation: 2,
  },
  retryText: {
    color: 'white',
    fontWeight: 'bold',
    fontFamily: 'Roboto',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'Roboto',
  },
  createButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    elevation: 4,
  },
  createButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontFamily: 'Roboto',
  }
});

export default TripsScreen; 