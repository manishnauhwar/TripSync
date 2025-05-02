import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Appbar, 
  Button, 
  Card, 
  Dialog, 
  Portal, 
  TextInput, 
  IconButton, 
  FAB, 
  Menu,
  Divider
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import api from '../apis/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ItineraryScreen = ({ route, navigation }) => {
  const { tripId, tripName, startDate, endDate } = route.params;
  const [loading, setLoading] = useState(true);
  const [itinerary, setItinerary] = useState([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [days, setDays] = useState([]);
  const [visible, setVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemValues, setItemValues] = useState({
    title: '',
    description: '',
    location: '',
    startTime: new Date(),
    endTime: new Date(Date.now() + 3600000)
  });
  const [userRole, setUserRole] = useState('viewer');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.log('Invalid start or end date');
        const today = new Date();
        setDays([{
          day: 1,
          date: today
        }]);
        return;
      }
      
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
      
      const daysList = Array.from({ length: diffDays }, (_, i) => {
        const day = new Date(start);
        day.setDate(start.getDate() + i);
        return {
          day: i + 1,
          date: day
        };
      });
      
      setDays(daysList);
      if (selectedDay > diffDays) {
        setSelectedDay(1);
      }
    } else {
      // If no start/end dates, create a default 1-day schedule for today
      console.log('No start or end date provided, using today');
      const today = new Date();
      setDays([{
        day: 1,
        date: today
      }]);
      setSelectedDay(1);
    }
  }, [startDate, endDate]);

  useFocusEffect(
    useCallback(() => {
      fetchItinerary();
    }, [tripId])
  );

  const fetchItinerary = async () => {
    setLoading(true);
    try {
      console.log('Fetching itinerary for tripId:', tripId);
      const response = await api.getItinerary(tripId);
      
      console.log('Itinerary response:', response);
      
      if (response.success) {
        console.log('Itinerary fetch successful');
        
        // Check data structure and set itinerary items
        let items = [];
        if (response.data.data && response.data.data.data) {
          items = response.data.data.data;
          console.log('Itinerary items count:', items.length);
        } else if (response.data.data) {
          items = response.data.data;
          console.log('Itinerary items count:', items.length);
        } else if (Array.isArray(response.data)) {
          items = response.data;
          console.log('Itinerary items count (direct array):', items.length);
        } else {
          console.log('Unexpected itinerary data structure:', response.data);
        }
        
        setItinerary(items);
        
        // Get user role from trip data
        try {
          const tripResponse = await api.getTripById(tripId);
          console.log('Trip response for role check:', tripResponse);
          
          if (tripResponse.success) {
            console.log('Trip data received for role check');
            
            // Get user details from AsyncStorage as a fallback
            const userDetailsStr = await AsyncStorage.getItem('userDetails');
            const userDetails = userDetailsStr ? JSON.parse(userDetailsStr) : null;
            console.log('User details from storage:', userDetails);
            
            // Check if the response has the right structure
            if (tripResponse.data && tripResponse.data.data && tripResponse.data.data.participants) {
              // Try to get the current user from the response or from storage
              const currentUser = 
                (tripResponse.data.user || {}).email ? 
                tripResponse.data.user : 
                userDetails;
                
              if (currentUser && currentUser.email) {
                console.log('Current user email:', currentUser.email);
                
                const userParticipant = tripResponse.data.data.participants.find(
                  p => p.email === currentUser.email
                );
                
                if (userParticipant) {
                  console.log('User role found:', userParticipant.role);
                  setUserRole(userParticipant.role);
                } else {
                  console.log('User not found in participants');
                  setUserRole('viewer'); // Default to viewer role
                }
              } else {
                console.log('No user email found in response or storage');
                setUserRole('viewer'); // Default to viewer role
              }
            } else {
              console.log('Unexpected trip data structure:', tripResponse.data);
              setUserRole('viewer'); // Default to viewer role
            }
          } else {
            console.log('Failed to get trip details:', tripResponse.error);
            setUserRole('viewer'); // Default to viewer role
          }
        } catch (tripError) {
          console.error('Error fetching trip details:', tripError);
          setUserRole('viewer'); // Default to viewer role
        }
      } else {
        console.error('Itinerary fetch failed:', response.error);
        Alert.alert(
          'Error', 
          response.error,
          [
            { 
              text: 'Retry', 
              onPress: () => fetchItinerary() 
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
    } catch (error) {
      console.error('Exception in fetchItinerary:', error);
      Alert.alert(
        'Error', 
        'Failed to fetch itinerary. Please check your connection.',
        [
          { 
            text: 'Retry', 
            onPress: () => fetchItinerary() 
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const showAddDialog = () => {
    setEditingItem(null);
    setItemValues({
      title: '',
      description: '',
      location: '',
      startTime: new Date(),
      endTime: new Date(Date.now() + 3600000) 
    });
    setVisible(true);
  };

  const showEditDialog = (item) => {
    setEditingItem(item);
    setItemValues({
      title: item.title,
      description: item.description || '',
      location: item.location || '',
      startTime: item.startTime ? new Date(item.startTime) : new Date(),
      endTime: item.endTime ? new Date(item.endTime) : new Date(Date.now() + 3600000)
    });
    setVisible(true);
  };

  const hideDialog = () => {
    setVisible(false);
  };

  const handleAddItem = async () => {
    if (!itemValues.title) {
      Alert.alert('Error', 'Title is required');
      return;
    }

    try {
      setLoading(true);
      
      const itemData = {
        day: selectedDay,
        title: itemValues.title,
        description: itemValues.description,
        location: itemValues.location,
        startTime: itemValues.startTime,
        endTime: itemValues.endTime
      };
      
      let response;
      
      if (editingItem) {
        response = await api.updateItineraryItem(tripId, editingItem._id, itemData);
      } else {
        response = await api.addItineraryItem(tripId, itemData);
      }
      
      if (response.success) {
        hideDialog();
        fetchItinerary();
      } else {
        Alert.alert('Error', response.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save itinerary item');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await api.deleteItineraryItem(tripId, itemId);
              
              if (response.success) {
                fetchItinerary();
              } else {
                Alert.alert('Error', response.error);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete itinerary item');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDragEnd = async ({ data }) => {
    try {
      const filteredItems = data.filter(item => item.day === selectedDay);
      setItinerary(prev => {
        const otherDayItems = prev.filter(item => item.day !== selectedDay);
        return [...otherDayItems, ...filteredItems];
      });
      
      const reorderItems = filteredItems.map((item, index) => ({
        id: item._id,
        order: index
      }));
      
      const response = await api.reorderItineraryItems(tripId, selectedDay, reorderItems);
      
      if (!response.success) {
        Alert.alert('Error', response.error);
        fetchItinerary();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to reorder items');
      fetchItinerary();
    }
  };

  const formatTime = (date) => {
    if (!date) return '';
    
    try {
      const d = new Date(date);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return '';
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    
    try {
      const d = new Date(date);
      return d.toLocaleDateString(undefined, { 
        weekday: 'short',
        month: 'short', 
        day: 'numeric' 
      });
    } catch (error) {
      return '';
    }
  };

  const renderDayTabs = () => {
    return (
      <View style={styles.dayTabsWrapper}>
        <Text style={styles.dayTabsTitle}>Trip Schedule</Text>
        <FlatList
          horizontal
          data={days}
          keyExtractor={(item) => `day-${item.day}`}
          renderItem={({ item }) => {
            const isSelected = selectedDay === item.day;
            const dayDate = new Date(item.date);
            const dayNumber = dayDate.getDate();
            const month = dayDate.toLocaleString('default', { month: 'short' });
            
            return (
              <TouchableOpacity
                style={[
                  styles.dayTab,
                  isSelected && styles.selectedDayTab
                ]}
                onPress={() => setSelectedDay(item.day)}
              >
                <View style={styles.dayTabContent}>
                  <Text style={[styles.dayMonth, isSelected && styles.selectedText]}>{month}</Text>
                  <Text style={[styles.dayNumber, isSelected && styles.selectedText]}>{dayNumber}</Text>
                  <Text style={[styles.dayLabel, isSelected && styles.selectedText]}>Day {item.day}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayTabsContainer}
        />
      </View>
    );
  };

  const renderItem = useCallback(({ item, drag, isActive }) => {
    if (item.day !== selectedDay) return null;
    
    return (
      <Card
        style={[
          styles.itemCard,
          isActive && styles.draggingItem
        ]}
      >
        <Card.Content>
          <View style={styles.itemHeader}>
            <View style={styles.timeLocationContainer}>
              <View style={styles.timeContainer}>
                <IconButton
                  icon="clock-outline"
                  size={20}
                  style={styles.timeIcon}
                  color="#6200ee"
                />
                <Text style={styles.itemTime}>
                  {formatTime(item.startTime)} - {formatTime(item.endTime)}
                </Text>
              </View>
            </View>
            
            {(userRole === 'admin' || userRole === 'editor') && (
              <View style={styles.itemActions}>
                <IconButton
                  icon="pencil"
                  size={20}
                  color="#6200ee"
                  onPress={() => showEditDialog(item)}
                />
                <IconButton
                  icon="delete"
                  size={20}
                  color="#f44336"
                  onPress={() => handleDeleteItem(item._id)}
                />
                <IconButton
                  icon="drag"
                  size={20}
                  color="#757575"
                  onLongPress={drag}
                />
              </View>
            )}
          </View>
          
          <View style={styles.contentContainer}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            
            {item.description ? (
              <Text style={styles.itemDescription}>{item.description}</Text>
            ) : null}
            
            {item.location ? (
              <View style={styles.locationContainer}>
                <IconButton icon="map-marker" size={20} style={styles.locationIcon} color="#f44336" />
                <Text style={styles.itemLocation}>{item.location}</Text>
              </View>
            ) : null}
          </View>
        </Card.Content>
      </Card>
    );
  }, [selectedDay, userRole]);

  const debugItinerary = async () => {
    try {
      console.log('Running itinerary debug for trip:', tripId);
      const response = await api.debugItinerary(tripId);
      if (response.success) {
        console.log('Debug successful:', response.data);
        Alert.alert(
          'Debug Info', 
          `Trip: ${response.data.tripName}\nParticipants: ${response.data.participantsCount}\nItinerary Items: ${response.data.itineraryCount}\nUser is participant: ${response.data.isUserParticipant}\nStart Date: ${response.data.startDate}\nEnd Date: ${response.data.endDate}`
        );
      } else {
        console.log('Debug failed:', response.error);
        Alert.alert('Debug Failed', response.error);
      }
    } catch (error) {
      console.error('Debug error:', error);
      Alert.alert('Debug Error', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header style={styles.appbarHeader}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
        <Appbar.Content title={`${tripName} Itinerary`} titleStyle={styles.headerTitle} />
        {(userRole === 'admin' || userRole === 'editor') && (
          <Appbar.Action icon="refresh" onPress={fetchItinerary} color="#fff" />
        )}
        <Appbar.Action icon="bug" onPress={debugItinerary} color="#fff" />
      </Appbar.Header>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text style={styles.loadingText}>Loading itinerary...</Text>
        </View>
      )}

      {!loading && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}
        >
          {days.length > 0 ? (
            <>
              {renderDayTabs()}
              
              <View style={styles.itineraryContainer}>
                {itinerary.filter(item => item.day === selectedDay).length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No activities planned for this day</Text>
                    {(userRole === 'admin' || userRole === 'editor') && (
                      <Button 
                        mode="contained" 
                        icon="plus" 
                        onPress={showAddDialog}
                        style={styles.addActivityButton}
                      >
                        Add Activity
                      </Button>
                    )}
                  </View>
                ) : (
                  <DraggableFlatList
                    data={itinerary}
                    onDragEnd={handleDragEnd}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContainer}
                    ListFooterComponent={() => (
                      <View style={styles.listFooter}>
                        <Text style={styles.footerText}>
                          {userRole === 'admin' || userRole === 'editor' 
                            ? 'Drag items to reorder your activities.' 
                            : 'Contact the trip organizer to make changes.'}
                        </Text>
                      </View>
                    )}
                  />
                )}
              </View>
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                Trip dates not set. Please set trip start and end dates to plan your itinerary.
              </Text>
            </View>
          )}

          {(userRole === 'admin' || userRole === 'editor') && itinerary.filter(item => item.day === selectedDay).length > 0 && (
            <FAB
              style={styles.fab}
              icon="plus"
              onPress={showAddDialog}
              color="#fff"
            />
          )}
        </KeyboardAvoidingView>
      )}

      <Portal>
        <Dialog visible={visible} onDismiss={hideDialog}>
          <Dialog.Title>{editingItem ? 'Edit Activity' : 'Add Activity'}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Title"
              value={itemValues.title}
              onChangeText={(text) => setItemValues({...itemValues, title: text})}
              style={styles.input}
            />
            <TextInput
              label="Description"
              value={itemValues.description}
              onChangeText={(text) => setItemValues({...itemValues, description: text})}
              multiline
              numberOfLines={2}
              style={styles.input}
            />
            <TextInput
              label="Location"
              value={itemValues.location}
              onChangeText={(text) => setItemValues({...itemValues, location: text})}
              style={styles.input}
            />
            
            <TouchableOpacity
              onPress={() => setShowStartDatePicker(true)}
              style={styles.timeInput}
            >
              <Text style={styles.timeInputLabel}>Start Time</Text>
              <Text>{formatTime(itemValues.startTime)}</Text>
            </TouchableOpacity>
            
            {showStartDatePicker && (
              <DateTimePicker
                value={itemValues.startTime}
                mode="time"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowStartDatePicker(false);
                  if (selectedDate) {
                    setItemValues({...itemValues, startTime: selectedDate});
                  }
                }}
              />
            )}
            
            <TouchableOpacity
              onPress={() => setShowEndDatePicker(true)}
              style={styles.timeInput}
            >
              <Text style={styles.timeInputLabel}>End Time</Text>
              <Text>{formatTime(itemValues.endTime)}</Text>
            </TouchableOpacity>
            
            {showEndDatePicker && (
              <DateTimePicker
                value={itemValues.endTime}
                mode="time"
                display="default"
                onChange={(event, selectedDate) => {
                  setShowEndDatePicker(false);
                  if (selectedDate) {
                    setItemValues({...itemValues, endTime: selectedDate});
                  }
                }}
              />
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={hideDialog}>Cancel</Button>
            <Button onPress={handleAddItem} mode="contained">{editingItem ? 'Update' : 'Add'}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  appbarHeader: {
    backgroundColor: '#6200ee',
  },
  headerTitle: {
    color: '#fff',
    fontWeight: 'bold'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 10,
    color: '#6200ee',
    fontSize: 16
  },
  dayTabsWrapper: {
    padding: 15,
    backgroundColor: '#fff', 
    marginBottom: 10,
    elevation: 2
  },
  dayTabsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333'
  },
  dayTabsContainer: {
    paddingVertical: 5
  },
  dayTab: {
    padding: 12,
    marginRight: 10,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    minWidth: 70,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1
  },
  selectedDayTab: {
    backgroundColor: '#e1d7fc',
    borderColor: '#6200ee',
    borderWidth: 1
  },
  dayTabContent: {
    alignItems: 'center'
  },
  dayMonth: {
    fontSize: 12,
    color: '#666'
  },
  dayNumber: {
    fontWeight: 'bold',
    fontSize: 20,
    marginVertical: 2,
    color: '#333'
  },
  dayLabel: {
    fontSize: 12,
    color: '#666'
  },
  selectedText: {
    color: '#6200ee'
  },
  itineraryContainer: {
    flex: 1,
    padding: 10
  },
  listContainer: {
    paddingBottom: 80
  },
  itemCard: {
    marginBottom: 12,
    elevation: 2,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderLeftWidth: 4,
    borderLeftColor: '#6200ee'
  },
  draggingItem: {
    opacity: 0.7,
    transform: [{ scale: 1.05 }],
    elevation: 5
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5
  },
  timeLocationContainer: {
    flex: 1
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10
  },
  timeIcon: {
    margin: 0,
    padding: 0
  },
  itemTime: {
    fontSize: 14,
    color: '#666',
    fontWeight: 'bold'
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5
  },
  locationIcon: {
    margin: 0,
    padding: 0
  },
  itemLocation: {
    fontSize: 14,
    color: '#555'
  },
  itemActions: {
    flexDirection: 'row'
  },
  contentContainer: {
    marginLeft: 10
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333'
  },
  itemDescription: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#6200ee'
  },
  input: {
    marginBottom: 10
  },
  timeInput: {
    marginVertical: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5
  },
  timeInputLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20
  },
  addActivityButton: {
    marginTop: 15,
    backgroundColor: '#6200ee',
    paddingHorizontal: 20
  },
  listFooter: {
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 80
  },
  footerText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic'
  }
});

export default ItineraryScreen; 