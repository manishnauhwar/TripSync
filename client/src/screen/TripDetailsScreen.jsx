import React, { useState, useEffect } from 'react';
import { 
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Card, Button, Menu, Divider, Avatar } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../apis/api';

const TripDetailsScreen = ({ route, navigation }) => {
  const { tripId } = route.params;
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuVisible, setMenuVisible] = useState({});
  const [userRole, setUserRole] = useState(null);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);

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
      <Card style={styles.participantCard}>
        <Card.Content>
          <View style={styles.participantHeader}>
            <View style={styles.participantInfo}>
              <Avatar.Text 
                size={40} 
                label={getInitials(item.email)} 
                style={[styles.avatar, { backgroundColor: getAvatarColor(item) }]}
              />
              <View style={styles.participantDetails}>
                <Text style={styles.participantName}>{item.email}</Text>
                {roleDisplay && (
                  <Text style={styles.participantRole}>{roleDisplay}</Text>
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
        </Card.Content>
      </Card>
    );
  };

  if (loading && !trip) {
    return (
      <SafeAreaView style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Trip Details" />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200ea" />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !trip) {
    return (
      <SafeAreaView style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title="Trip Details" />
        </Appbar.Header>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Button mode="contained" onPress={fetchTripDetails}>Retry</Button>
        </View>
      </SafeAreaView>
    );
  }

  const acceptedParticipants = trip?.participants.filter(p => p.status === 'accepted') || [];

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={trip?.name || 'Trip Details'} />
      </Appbar.Header>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      )}

      {!loading && error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {!loading && !error && trip && (
        <ScrollView style={styles.scrollView}>
          
          {/* Trip Actions Buttons */}
          <View style={styles.actionButtonsContainer}>
            <Button 
              mode="contained" 
              icon="calendar" 
              style={styles.actionButton}
              onPress={() => {
                console.log('Navigating to Itinerary with params:', {
                  tripId: trip._id,
                  tripName: trip.name,
                  startDate: trip.startDate,
                  endDate: trip.endDate
                });
                navigation.navigate('Itinerary', { 
                  tripId: trip._id,
                  tripName: trip.name,
                  startDate: trip.startDate,
                  endDate: trip.endDate
                });
              }}
            >
              Itinerary
            </Button>
            
            <Button 
              mode="contained" 
              icon="chat" 
              style={styles.actionButton}
              onPress={() => navigation.navigate('Chat', { 
                tripId: trip._id,
                tripName: trip.name
              })}
            >
              Chat
            </Button>

            <Button 
              mode="contained" 
              icon="cash-multiple" 
              style={styles.actionButton}
              onPress={() => navigation.navigate('Billing', { 
                tripId: trip._id,
                tripName: trip.name,
                participants: trip.participants.filter(p => p.status === 'accepted')
              })}
            >
              Billing
            </Button>
          </View>
          
          {/* Trip Details Card */}
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Trip Details</Text>
              
              {trip.description && (
                <Text style={styles.description}>{trip.description}</Text>
              )}
              
              <View style={styles.dateContainer}>
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Start Date</Text>
                  <Text style={styles.dateValue}>
                    {formatDate(trip.startDate)}
                  </Text>
                </View>
                
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>End Date</Text>
                  <Text style={styles.dateValue}>
                    {formatDate(trip.endDate)}
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
          
          {/* Participants Section */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.participantsHeader}>
                <Text style={styles.sectionTitle}>Participants</Text>
                <Button 
                  mode="outlined" 
                  onPress={handleInviteParticipants}
                  style={styles.inviteButton}
                >
                  Invite
                </Button>
              </View>
              
              {trip.participants.filter(p => p.status === 'accepted').length === 0 ? (
                <Text style={styles.emptyText}>No participants yet</Text>
              ) : (
                trip.participants.filter(p => p.status === 'accepted').map(participant => (
                  <View key={participant._id} style={styles.participantRow}>
                    <View style={styles.participantInfo}>
                      <Avatar.Text 
                        size={40} 
                        label={getInitials(participant.email)} 
                        style={[styles.avatar, { backgroundColor: getAvatarColor(participant) }]}
                      />
                      <View style={styles.participantDetails}>
                        <Text style={styles.participantEmail}>{participant.email}</Text>
                        {getParticipantRoleDisplay(participant) && (
                          <Text style={styles.participantRole}>
                            {getParticipantRoleDisplay(participant)}
                          </Text>
                        )}
                      </View>
                    </View>
                    
                    {userRole === 'admin' && participant.email !== currentUserEmail && (
                      <Menu
                        visible={menuVisible[participant._id]}
                        onDismiss={() => hideRoleMenu(participant._id)}
                        anchor={
                          <Button 
                            mode="text" 
                            onPress={() => showRoleMenu(participant._id)}
                          >
                            Role
                          </Button>
                        }
                      >
                        <Menu.Item 
                          title="Editor"
                          onPress={() => changeParticipantRole(participant._id, 'editor')}
                        />
                        <Menu.Item 
                          title="Viewer"
                          onPress={() => changeParticipantRole(participant._id, 'viewer')}
                        />
                      </Menu>
                    )}
                  </View>
                ))
              )}
            </Card.Content>
          </Card>
          
          {/* Pending Invitations Section */}
          {trip.participants.filter(p => p.status === 'invited').length > 0 && (
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.sectionTitle}>Pending Invitations</Text>
                
                {trip.participants.filter(p => p.status === 'invited').map(participant => (
                  <View key={participant._id} style={styles.participantRow}>
                    <View style={styles.participantInfo}>
                      <Avatar.Text 
                        size={40} 
                        label={getInitials(participant.email)} 
                        style={styles.pendingAvatar}
                      />
                      <View style={styles.participantDetails}>
                        <Text style={styles.participantEmail}>{participant.email}</Text>
                        <Text style={styles.pendingStatus}>Awaiting response</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </Card.Content>
            </Card>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  mainContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingVertical: 8,
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
    marginBottom: 16,
  },
  infoCard: {
    marginBottom: 20,
    elevation: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tripName: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#212121',
  },
  tripDescription: {
    fontSize: 16,
    color: '#555',
    marginBottom: 16,
    lineHeight: 22,
  },
  divider: {
    marginVertical: 12,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    width: 100,
    color: '#424242',
  },
  dateValue: {
    fontSize: 15,
    color: '#444',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
  },
  participantCount: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f1f1f1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  participantsList: {
    flex: 1,
  },
  participantCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    elevation: 1,
    borderRadius: 8,
    overflow: 'hidden',
    borderLeftWidth: 3,
    borderLeftColor: '#6200ea',
  },
  participantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#212121',
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  participantRole: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  roleButton: {
    marginVertical: 0,
    borderRadius: 4,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    padding: 20,
    fontStyle: 'italic',
  },
  inviteButton: {
    margin: 16,
    marginTop: 8,
    backgroundColor: '#6200ea',
    borderRadius: 8,
    elevation: 2,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginVertical: 15,
    marginHorizontal: 10
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 5
  },
  card: {
    marginBottom: 20,
    elevation: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  description: {
    fontSize: 16,
    color: '#555',
    marginBottom: 16,
    lineHeight: 22,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  participantsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  participantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  participantEmail: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
  },
  pendingAvatar: {
    marginRight: 12,
    backgroundColor: '#9e9e9e',
  },
  pendingStatus: {
    fontSize: 13,
    color: '#666',
  },
});

export default TripDetailsScreen;