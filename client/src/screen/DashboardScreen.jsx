import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  Alert,
  ImageBackground,
  StatusBar,
  Image,
  useColorScheme,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Card, Button, FAB, IconButton } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import api from '../apis/api';
import { LinearGradient } from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
// import { navigationRef } from '../apis/navigationRef';

const { width, height } = Dimensions.get('window');

const DashboardScreen = () => {
  const navigation = useNavigation();
  const [username, setUsername] = useState('');
  const [recentTrips, setRecentTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [error, setError] = useState(null);
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const theme = {
    background: isDarkMode ? 'rgba(18, 18, 18, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    text: isDarkMode ? '#FFFFFF' : '#333333',
    cardBackground: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    subtext: isDarkMode ? '#AAAAAA' : '#666666',
    primary: '#6200ea',
    accent: '#03DAC6',
    error: '#CF6679',
    divider: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
  };

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
    navigation.navigate('CreateTrip');
  };

  const handleViewAllTrips = () => {
    navigation.navigate('Trips');
  };

  const handleViewTrip = (tripId) => {
    navigation.navigate('TripDetails', { tripId });
  };

  const handleLogout = async () => {
    try {
      setLogoutLoading(true);
      // Call API logout first
      await api.logout().catch(err => console.log('API logout error:', err));
      
      // Remove data from AsyncStorage
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('userDetails');
      
      // Force app to re-render by triggering a state change
      await AsyncStorage.setItem('forceUpdate', Date.now().toString());
    } catch (error) {
      console.log('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    } finally {
      setLogoutLoading(false);
    }
  };

  const renderTripCard = ({ item }) => (
    <TouchableOpacity onPress={() => handleViewTrip(item._id)} style={styles.tripCardContainer}>
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
                  {item.participants.length} participant{item.participants.length !== 1 ? 's' : ''}
                </Text>
              </View>
              <IconButton
                icon="arrow-right"
                size={20}
                color={theme.primary}
                onPress={() => handleViewTrip(item._id)}
              />
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

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
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <View style={styles.headerContent}>
            <View style={styles.welcomeContainer}>
              <Text style={[styles.welcomeText, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">
                Hello, {username}!
              </Text>
              <Text style={[styles.subtitle, { color: theme.subtext }]}>Where to next?</Text>
            </View>
            <IconButton
              icon={logoutLoading ? "loading" : "logout"}
              size={24}
              color={theme.text}
              onPress={handleLogout}
              disabled={logoutLoading}
            />
          </View>
        </View>

        <View style={styles.contentContainer}>
          <View style={[styles.sectionContainer, { backgroundColor: theme.background }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Trips</Text>
              {recentTrips.length > 0 && (
                <TouchableOpacity onPress={handleViewAllTrips}>
                  <Text style={[styles.viewAllText, { color: theme.primary }]}>View All</Text>
                </TouchableOpacity>
              )}
            </View>

            {loading ? (
              <ActivityIndicator size="large" color={theme.primary} style={styles.loader} />
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
                <Button 
                  mode="contained" 
                  onPress={fetchRecentTrips}
                  color={theme.primary}
                >
                  Retry
                </Button>
              </View>
            ) : recentTrips.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="map-search" size={64} color={theme.subtext} style={styles.emptyIcon} />
                <Text style={[styles.emptyText, { color: theme.subtext }]}>You don't have any trips yet</Text>
                <Button 
                  mode="contained" 
                  icon="plus" 
                  onPress={handleCreateTrip}
                  style={[styles.createButton, { backgroundColor: theme.primary }]}
                  labelStyle={{ color: '#FFFFFF' }}
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
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>

        <FAB
          style={[styles.fab, { backgroundColor: theme.primary }]}
          icon="plus"
          onPress={handleCreateTrip}
          color="#fff"
        />
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
    marginBottom: 30,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderRadius: 30,
    margin: 16,
    marginBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeContainer: {
    flex: 1,
    marginRight: 16,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
    fontFamily: 'Tagesschrift',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 8,
    fontFamily: 'Roboto',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionContainer: {
    borderRadius: 24,
    padding: 20,
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'Roboto', 
  },
  viewAllText: {
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: 'Roboto', 
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
  listContainer: {
    paddingBottom: 80,
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
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: 'Roboto', 
  },
  createButton: {
    paddingHorizontal: 16,
    borderRadius: 30,
    elevation: 4,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
  },
  errorText: {
    marginBottom: 16,
    fontFamily: 'Roboto', 
  },
  loader: {
    marginTop: 20,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 16,
    bottom: 16,
    borderRadius: 30,
    elevation: 6,
  },
});

export default DashboardScreen;