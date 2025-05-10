import React, { useState, useEffect } from 'react';
import { 
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Alert,
  ImageBackground,
  StatusBar,
  useColorScheme,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Card, Button, Menu, Divider, Avatar, IconButton } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../apis/api';
import { LinearGradient } from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

const TripDetailsScreen = ({ route, navigation }) => {
  const { tripId } = route.params;
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuVisible, setMenuVisible] = useState({});
  const [userRole, setUserRole] = useState(null);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const theme = {
    background: isDarkMode ? 'rgba(18, 18, 18, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    text: isDarkMode ? '#FFFFFF' : '#333333',
    cardBackground: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    subtext: isDarkMode ? '#AAAAAA' : '#666666',
    primary: '#2E7D32',
    accent: '#03DAC6',
    error: '#CF6679',
    divider: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
    pending: isDarkMode ? '#E7A600' : '#FF9800',
  };

  useEffect(() => {
    fetchTripDetails();

    const unsubscribe = navigation.addListener('focus', () => {
      fetchTripDetails();
    });

    return unsubscribe;
  }, [navigation, tripId]);

  const fetchTripDetails = async () => {
    setLoading(true);
    try {
      console.log('Fetching trip details for ID:', tripId);
      const response = await api.getTripById(tripId);
      
      console.log('Trip API response:', response);
      
      if (response.success) {
        setTrip(response.data.data);
        
        const userData = await AsyncStorage.getItem('userDetails');
        const token = await AsyncStorage.getItem('token');
        console.log('User token:', token);
        console.log('User data from storage:', userData);
        
        if (userData) {
          const user = JSON.parse(userData);
          setCurrentUserEmail(user.email);
          
          const participant = response.data.data.participants.find(
            p => p.email === user.email
          );
          
          if (participant) {
            setUserRole(participant.role);
          } else {
            console.log('Current user not found in participants');
          }
        } else {
          console.log('No user data found in storage');
        }
        
        setError(null);
      } else {
        console.error('Error in API response:', response.error);
        setError(response.error || 'Failed to fetch trip details');
      }
    } catch (err) {
      console.error('Exception fetching trip:', err);
      setError('Failed to fetch trip details. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteParticipants = () => {
    navigation.navigate('InviteParticipants', { 
      tripId, 
      tripName: trip?.name 
    });
  };

  const showRoleMenu = (participantId) => {
    setMenuVisible({...menuVisible, [participantId]: true});
  };

  const hideRoleMenu = (participantId) => {
    setMenuVisible({...menuVisible, [participantId]: false});
  };

  const changeParticipantRole = async (participantId, newRole) => {
    try {
      setLoading(true);
      const response = await api.updateParticipantRole(tripId, participantId, newRole);
      
      if (response.success) {
        Alert.alert('Success', 'Participant role updated');
        fetchTripDetails();
      } else {
        Alert.alert('Error', response.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update participant role');
    } finally {
      setLoading(false);
      hideRoleMenu(participantId);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      };
      
      return date.toLocaleDateString(undefined, options);
    } catch (error) {
      console.log('Date formatting error:', error);
      return 'Date error';
    }
  };

  const getInitials = (email) => {
    if (!email) return '?';
    
    const parts = email.split('@');
    if (parts.length === 0) return '?';
    
    const name = parts[0];
    if (name.length === 0) return '?';
    
    return name.charAt(0).toUpperCase();
  };

  const getParticipantRoleDisplay = (participant) => {
    if (participant.role === 'admin') {
      return 'Creator';
    } else if (participant.role === 'editor') {
      return 'Editor';
    } else {
      return null; 
    }
  };

  const getAvatarColor = (participant) => {
    const isCreator = participant.role === 'admin' && 
                      trip?.participants.findIndex(p => 
                        p.role === 'admin' && p._id === participant._id
                      ) === trip?.participants.findIndex(p => p.role === 'admin');
    
    if (isCreator) {
      return '#6200ea'; 
    } else if (participant.role === 'admin') {
      return '#9c27b0'; 
    } else if (participant.role === 'editor') {
      return '#03a9f4';
    } else {
      return '#9e9e9e';
    }
  };

  const renderParticipant = ({ item }) => {
    if (item.status !== 'accepted') {
      return null;
    }
    
    const isAdmin = userRole === 'admin';
    const isCurrentUser = item.email === currentUserEmail;
    const canChangeRole = isAdmin && !isCurrentUser;
    const roleDisplay = getParticipantRoleDisplay(item);
    
    return (
      <LinearGradient
        colors={['rgba(98, 0, 234, 0.1)', 'rgba(3, 218, 198, 0.1)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.participantGradient}
      >
        <View style={[styles.participantCard, { backgroundColor: theme.cardBackground }]}>
          <View style={styles.participantHeader}>
            <View style={styles.participantInfo}>
              <Avatar.Text 
                size={40} 
                label={getInitials(item.email)} 
                style={[styles.avatar, { backgroundColor: getAvatarColor(item) }]}
              />
              <View style={styles.participantDetails}>
                <Text style={[styles.participantName, { color: theme.text }]}>{item.email}</Text>
                {roleDisplay && (
                  <Text style={[styles.participantRole, { color: theme.subtext }]}>{roleDisplay}</Text>
                )}
              </View>
            </View>
            
            {canChangeRole && (
              <Menu
                visible={menuVisible[item._id]}
                onDismiss={() => hideRoleMenu(item._id)}
                anchor={
                  <Button 
                    mode="text" 
                    onPress={() => showRoleMenu(item._id)}
                    style={styles.roleButton}
                    textColor={theme.primary}
                  >
                    Change Role
                  </Button>
                }
              >
                <Menu.Item 
                  onPress={() => changeParticipantRole(item._id, 'editor')} 
                  title="Editor" 
                />
                <Menu.Item 
                  onPress={() => changeParticipantRole(item._id, 'viewer')} 
                  title="Viewer" 
                />
              </Menu>
            )}
          </View>
        </View>
      </LinearGradient>
    );
  };

  const handleItineraryPress = () => {
    navigation.navigate('Itinerary', { 
      tripId, 
      tripName: trip?.name, 
      startDate: trip?.startDate, 
      endDate: trip?.endDate 
    });
  };

  const handleChatPress = () => {
    navigation.navigate('Chat', { tripId, tripName: trip?.name });
  };

  const handleBillingPress = () => {
    navigation.navigate('Billing', { 
      tripId, 
      tripName: trip?.name, 
      participants: trip?.participants.filter(p => p.status === 'accepted') || [] 
    });
  };

  const handleDocumentsPress = () => {
    navigation.navigate('Documents', { tripId, tripName: trip?.name });
  };

  const goBack = () => {
    navigation.goBack();
  };

  const actionButtons = [
    {
      icon: 'file-document-multiple',
      label: 'Documents',
      onPress: handleDocumentsPress
    },
    {
      icon: 'calendar',
      label: 'Itinerary',
      onPress: handleItineraryPress
    },
    {
      icon: 'chat',
      label: 'Chat',
      onPress: handleChatPress
    },
    {
      icon: 'cash-multiple',
      label: 'Billing',
      onPress: handleBillingPress
    },
  ];

  const renderActionButton = ({ item }) => (
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor: theme.primary }]}
      onPress={item.onPress}
    >
      <Icon name={item.icon} color="#FFF" size={24} />
      <Text style={styles.actionButtonText}>{item.label}</Text>
    </TouchableOpacity>
  );

  if (loading && !trip) {
    return (
      <ImageBackground
        source={require('../assets/images/3.jpg')}
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
              />
              <Text style={[styles.headerTitle, { color: theme.text }]}>Trip Details</Text>
              <View style={{ width: 40 }} />
            </View>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  if (error && !trip) {
    return (
      <ImageBackground
        source={require('../assets/images/3.jpg')}
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
              />
              <Text style={[styles.headerTitle, { color: theme.text }]}>Trip Details</Text>
              <View style={{ width: 40 }} />
            </View>
          </View>
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            <Button 
              mode="contained" 
              onPress={fetchTripDetails}
              buttonColor={theme.primary}
            >
              Retry
            </Button>
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }

  const acceptedParticipants = trip?.participants.filter(p => p.status === 'accepted') || [];
  const pendingParticipants = trip?.participants.filter(p => p.status === 'invited') || [];

  return (
    <ImageBackground
      source={require('../assets/images/3.jpg')}
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
            />
            <Text style={[styles.headerTitle, { color: theme.text }]}>{trip?.name || 'Trip Details'}</Text>
            <View style={{ width: 40 }} />
          </View>
        </View>

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}

        <View style={styles.contentContainer}>
          <View style={[styles.contentWrapper, { backgroundColor: theme.background }]}>
            {!loading && !error && trip && (
              <ScrollView 
                style={styles.scrollView}
                showsVerticalScrollIndicator={false}
              >
                {/* Horizontally scrollable action buttons */}
                <View style={styles.actionButtonsSection}>
                  <FlatList
                    data={actionButtons}
                    renderItem={renderActionButton}
                    keyExtractor={(item) => item.label}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.actionButtonsContainer}
                  />
                </View>
                
                {/* Trip Details Card */}
                <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Trip Details</Text>
                  
                  {trip.description && (
                    <Text style={[styles.description, { color: theme.subtext }]}>{trip.description}</Text>
                  )}
                  
                  <View style={styles.dateContainer}>
                    <View style={styles.dateItem}>
                      <Text style={[styles.dateLabel, { color: theme.text }]}>Start Date</Text>
                      <Text style={[styles.dateValue, { color: theme.subtext }]}>
                        {formatDate(trip.startDate)}
                      </Text>
                    </View>
                    
                    <View style={styles.dateItem}>
                      <Text style={[styles.dateLabel, { color: theme.text }]}>End Date</Text>
                      <Text style={[styles.dateValue, { color: theme.subtext }]}>
                        {formatDate(trip.endDate)}
                      </Text>
                    </View>
                  </View>
                </View>
                
                {/* Participants Section */}
                <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
                  <View style={styles.participantsHeader}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Participants</Text>
                    <Button 
                      mode="contained" 
                      onPress={handleInviteParticipants}
                      buttonColor={theme.primary}
                      textColor="#FFF"
                      style={styles.inviteButton}
                    >
                      Invite
                    </Button>
                  </View>
                  
                  {acceptedParticipants.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <Icon name="account-group" size={48} color={theme.subtext} style={styles.emptyIcon} />
                      <Text style={[styles.emptyText, { color: theme.subtext }]}>No participants yet</Text>
                    </View>
                  ) : (
                    <FlatList
                      data={acceptedParticipants}
                      renderItem={renderParticipant}
                      keyExtractor={item => item._id}
                      scrollEnabled={false}
                    />
                  )}
                </View>
                
                {/* Pending Invitations Section */}
                {pendingParticipants.length > 0 && (
                  <View style={[styles.card, { backgroundColor: theme.cardBackground }]}>
                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Pending Invitations</Text>
                    
                    {pendingParticipants.map(participant => (
                      <View key={participant._id} style={styles.pendingItem}>
                        <View style={styles.participantInfo}>
                          <Avatar.Text 
                            size={40} 
                            label={getInitials(participant.email)} 
                            backgroundColor={theme.pending}
                            color="#fff"
                          />
                          <View style={styles.participantDetails}>
                            <Text style={[styles.participantEmail, { color: theme.text }]}>{participant.email}</Text>
                            <View style={styles.pendingStatusContainer}>
                              <Icon name="clock-outline" size={16} color={theme.pending} />
                              <Text style={[styles.pendingStatus, { color: theme.pending }]}>Awaiting response</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
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
    // marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
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
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
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
  actionButtonsSection: {
    marginBottom: 16,
  },
  actionButtonsContainer: {
    paddingVertical: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 30,
    marginRight: 12,
    elevation: 2,
  },
  actionButtonText: {
    color: '#FFF',
    marginLeft: 8,
    fontWeight: 'bold',
    fontFamily: 'Roboto',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    fontFamily: 'Roboto',
  },
  description: {
    fontSize: 16,
    marginBottom: 16,
    lineHeight: 22,
    fontFamily: 'Roboto',
  },
  dateContainer: {
    marginBottom: 8,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    fontFamily: 'Roboto',
  },
  dateValue: {
    fontSize: 15,
    fontFamily: 'Roboto',
  },
  participantsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  inviteButton: {
    borderRadius: 30,
  },
  participantGradient: {
    marginBottom: 12,
    borderRadius: 16,
    padding: 1,
  },
  participantCard: {
    borderRadius: 15,
    padding: 12,
  },
  participantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    marginRight: 12,
  },
  participantDetails: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Roboto',
  },
  participantEmail: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Roboto',
  },
  participantRole: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
    fontFamily: 'Roboto',
  },
  roleButton: {
    marginVertical: 0,
    borderRadius: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    marginBottom: 8,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    fontFamily: 'Roboto',
  },
  pendingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
  },
  pendingStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  pendingStatus: {
    fontSize: 13,
    marginLeft: 4,
    fontFamily: 'Roboto',
  },
});

export default TripDetailsScreen;