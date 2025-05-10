import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator, 
  Alert, 
  Platform, 
  Dimensions, 
  ImageBackground,
  StatusBar,
  useColorScheme
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Button, Card, Dialog, Portal, TextInput, IconButton, FAB, Modal } from 'react-native-paper';
import { LinearGradient } from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import DraggableFlatList from 'react-native-draggable-flatlist';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../apis/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const ItineraryScreen = ({ route, navigation }) => {
  const { tripId, tripName = 'Trip', startDate, endDate } = route.params || {};
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
    endTime: new Date(Date.now() + 3600000),
  });
  const [userRole, setUserRole] = useState('viewer');
  const [showTimePicker, setShowTimePicker] = useState({ start: false, end: false });
  const [mapVisible, setMapVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const mapRef = useRef(null);
  const [tripDetails, setTripDetails] = useState({
    name: tripName || 'Trip',
    startDate: startDate,
    endDate: endDate
  });
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  // Theme colors based on the InviteParticipantsScreen
  const theme = {
    background: isDarkMode ? 'rgba(18, 18, 18, 0.75)' : 'rgba(255, 255, 255, 0.75)',
    cardBackground: isDarkMode ? 'rgba(30, 30, 30, 0.85)' : 'rgba(255, 255, 255, 0.85)',
    text: isDarkMode ? '#FFFFFF' : '#333333',
    subtext: isDarkMode ? '#CCCCCC' : '#555555',
    primary: '#6200ea',
    accent: '#03DAC6',
    error: '#CF6679',
    divider: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
    success: '#4CAF50',
    input: isDarkMode ? 'rgba(45, 45, 45, 0.6)' : '#FFFFFF',
    inactive: isDarkMode ? '#444444' : '#DDDDDD',
  };

  useEffect(() => {
    const start = new Date(tripDetails.startDate);
    const end = new Date(tripDetails.endDate);
    const today = new Date();
    let daysList = [{ day: 1, date: today }];

    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      daysList = Array.from({ length: diffDays }, (_, i) => ({
        day: i + 1,
        date: new Date(start.getTime() + i * 24 * 60 * 60 * 1000),
      }));
    }

    setDays(daysList);
    if (selectedDay > daysList.length) setSelectedDay(1);
  }, [tripDetails.startDate, tripDetails.endDate]);

  useEffect(() => {
    // Update tripDetails when route.params changes
    if (route.params) {
      const { tripName = tripDetails.name, startDate = tripDetails.startDate, endDate = tripDetails.endDate } = route.params;
      setTripDetails({
        name: tripName || 'Trip',
        startDate,
        endDate
      });
    }
  }, [route.params]);

  useFocusEffect(
    useCallback(() => {
      fetchItinerary();
    }, [tripId])
  );

  const fetchItinerary = async () => {
    setLoading(true);
    try {
      if (!tripId) {
        Alert.alert('Error', 'Trip ID is required');
        navigation.goBack();
        return;
      }

      // Fetch trip details if not provided
      if (!tripName || !startDate || !endDate) {
        console.log('Trip details missing, fetching from API...');
        const tripResponse = await api.getTripById(tripId);
        if (tripResponse.success && tripResponse.data?.data) {
          const tripData = tripResponse.data.data;
          setTripDetails({
            name: tripData.name || 'Trip',
            startDate: tripData.startDate,
            endDate: tripData.endDate
          });
        }
      }

      const response = await api.getItinerary(tripId);
      if (response.success) {
        const items = Array.isArray(response.data?.data?.data)
          ? response.data.data.data
          : Array.isArray(response.data)
            ? response.data
            : [];
        
        // Sort itinerary items by startTime
        const sortedItems = [...items].sort((a, b) => 
          new Date(a.startTime) - new Date(b.startTime)
        );
        
        setItinerary(sortedItems);

        const userDetails = JSON.parse(await AsyncStorage.getItem('userDetails') || '{}');
        const tripResponse = await api.getTripById(tripId);
        if (tripResponse.success && tripResponse.data?.data?.participants && userDetails?.email) {
          const user = tripResponse.data.data.participants.find(p => p.email === userDetails.email);
          setUserRole(user?.role || 'viewer');
        } else {
          setUserRole('viewer');
        }
      } else {
        Alert.alert('Error', response.error, [{ text: 'Retry', onPress: fetchItinerary }, { text: 'Cancel' }]);
      }
    } catch (error) {
      console.error('Error fetching itinerary:', error);
      Alert.alert('Error', 'Failed to fetch itinerary.', [{ text: 'Retry', onPress: fetchItinerary }, { text: 'Cancel' }]);
    } finally {
      setLoading(false);
    }
  };

  const showDialog = (item = null) => {
    setEditingItem(item);
    setItemValues(
      item
        ? {
            title: item.title || '',
            description: item.description || '',
            location: item.location || '',
            startTime: new Date(item.startTime || Date.now()),
            endTime: new Date(item.endTime || Date.now() + 3600000),
          }
        : {
            title: '',
            description: '',
            location: '',
            startTime: new Date(),
            endTime: new Date(Date.now() + 3600000),
          }
    );
    setVisible(true);
  };

  const hideDialog = () => setVisible(false);

  const handleSaveItem = async () => {
    if (!itemValues.title) {
      Alert.alert('Error', 'Title is required');
      return;
    }

    try {
      setLoading(true);
      const itemData = { day: selectedDay, ...itemValues };
      const response = editingItem
        ? await api.updateItineraryItem(tripId, editingItem._id, itemData)
        : await api.addItineraryItem(tripId, itemData);

      if (response.success) {
        hideDialog();
        fetchItinerary();
      } else {
        Alert.alert('Error', response.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    Alert.alert('Confirm', 'Delete this item?', [
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
            Alert.alert('Error', 'Failed to delete item');
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const handleDragEnd = async ({ data }) => {
    try {
      const dayItems = data.filter(item => item.day === selectedDay);
      const reorderedItems = [...dayItems];
      
      // Calculate total time range from first to last card
      if (reorderedItems.length > 0) {
        const firstStartTime = new Date(Math.min(...reorderedItems.map(item => new Date(item.startTime))));
        const lastEndTime = new Date(Math.max(...reorderedItems.map(item => new Date(item.endTime))));
        const totalDuration = lastEndTime - firstStartTime;
        
        // Distribute time slots evenly within the total time range
        const itemCount = reorderedItems.length;
        const avgDuration = totalDuration / itemCount;
        
        // Recompute all time slots based on new order
        reorderedItems.forEach((item, index) => {
          // Calculate individual item duration (keeping original durations)
          const itemDuration = new Date(item.endTime) - new Date(item.startTime);
          
          // Set new start time based on position in sequence
          const newStartTime = new Date(firstStartTime.getTime() + (index * avgDuration));
          item.startTime = newStartTime;
          
          // Set new end time based on original duration
          item.endTime = new Date(newStartTime.getTime() + itemDuration);
        });
      }

      // Sort the items by startTime before updating the state
      const sortedItems = [...reorderedItems].sort((a, b) => 
        new Date(a.startTime) - new Date(b.startTime)
      );

      setItinerary(prev => [...prev.filter(item => item.day !== selectedDay), ...sortedItems]);
      const itemsForUpdate = sortedItems.map((item, index) => ({
        id: item._id,
        order: index,
        startTime: item.startTime,
        endTime: item.endTime,
      }));

      const response = await api.reorderItineraryItems(tripId, selectedDay, itemsForUpdate);
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
    try {
      return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderDayTabs = () => (
    <View style={styles.dayTabs}>
      <FlatList
        horizontal
        data={days}
        keyExtractor={item => `day-${item.day}`}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.dayTab, 
              selectedDay === item.day && styles.selectedDayTab
            ]}
            onPress={() => setSelectedDay(item.day)}
          >
            <LinearGradient
              colors={selectedDay === item.day ? [theme.primary, theme.accent] : ['transparent', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.dayTabGradient}
            >
              <Text style={[
                styles.dayText, 
                selectedDay === item.day && styles.selectedDayText
              ]}>
                Day {item.day} ({new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayTabsContainer}
      />
    </View>
  );

  const openMap = (item = null) => {
    setSelectedLocation(item);
    setMapVisible(true);
  };

  const closeMap = () => {
    setMapVisible(false);
    setSelectedLocation(null);
  };

  const showFullMap = () => {
    setSelectedLocation(null);
    setMapVisible(true);
  };

  const hasCoordinates = (item) => {
    return item.coordinates && item.coordinates.lat && item.coordinates.lon;
  };

  const allLocationsWithCoordinates = () => {
    return itinerary.filter(item => hasCoordinates(item));
  };

  const getMapRegion = () => {
    const locations = allLocationsWithCoordinates();
    
    if (selectedLocation && hasCoordinates(selectedLocation)) {
      return {
        latitude: selectedLocation.coordinates.lat,
        longitude: selectedLocation.coordinates.lon,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    
    if (locations.length === 0) {
      return {
        latitude: 0,
        longitude: 0,
        latitudeDelta: 30,
        longitudeDelta: 30,
      };
    }
    
    if (locations.length === 1) {
      return {
        latitude: locations[0].coordinates.lat,
        longitude: locations[0].coordinates.lon,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }
    
    let minLat = Number.MAX_VALUE;
    let maxLat = Number.MIN_VALUE;
    let minLon = Number.MAX_VALUE;
    let maxLon = Number.MIN_VALUE;
    
    locations.forEach(item => {
      const { lat, lon } = item.coordinates;
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLon = Math.min(minLon, lon);
      maxLon = Math.max(maxLon, lon);
    });
    
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    const latDelta = (maxLat - minLat) * 1.5;
    const lonDelta = (maxLon - minLon) * 1.5;
    
    return {
      latitude: centerLat,
      longitude: centerLon,
      latitudeDelta: Math.max(0.1, latDelta),
      longitudeDelta: Math.max(0.1, lonDelta),
    };
  };

  const renderItem = useCallback(
    ({ item, drag, isActive }) => {
      if (item.day !== selectedDay) return null;
      
      return (
        <TouchableOpacity
          onLongPress={drag}
          disabled={isActive}
          style={{ marginBottom: 16 }}
        >
          <Card 
            style={[
              styles.itemCard, 
              isActive && styles.draggingItem,
              { backgroundColor: theme.cardBackground }
            ]} 
            elevation={3}
          >
            <Card.Content>
              <View style={styles.itemHeader}>
                <Text style={[styles.itemTime, { color: theme.primary }]}>
                  {formatTime(item.startTime)} - {formatTime(item.endTime)}
                </Text>
                {(userRole === 'admin' || userRole === 'editor') && (
                  <View style={styles.itemActions}>
                    <IconButton icon="pencil" size={20} iconColor={theme.primary} onPress={() => showDialog(item)} />
                    <IconButton icon="delete" size={20} iconColor="#f44336" onPress={() => handleDeleteItem(item._id)} />
                  </View>
                )}
              </View>
              <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
              {item.description && (
                <Text style={[styles.itemDescription, { color: theme.subtext }]}>{item.description}</Text>
              )}
              {item.location && (
                <View style={styles.locationContainer}>
                  <Icon name="map-marker" size={16} color="#f44336" style={styles.locationIcon} />
                  <Text style={[styles.itemLocation, { color: theme.subtext }]}>{item.location}</Text>
                  {hasCoordinates(item) && (
                    <TouchableOpacity onPress={() => openMap(item)} style={styles.mapButton}>
                      <LinearGradient
                        colors={[theme.primary, theme.accent]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.mapButtonGradient}
                      >
                        <Text style={styles.mapButtonText}>View on Map</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </Card.Content>
          </Card>
        </TouchableOpacity>
      );
    },
    [selectedDay, userRole, theme]
  );

  return (
    <ImageBackground
      source={require('../assets/images/4.jpg')}
      style={styles.backgroundImage}
    >
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <SafeAreaView style={styles.container}>
        <Appbar.Header style={[styles.appbar, { backgroundColor: 'transparent' }]}>
          <Appbar.BackAction onPress={() => navigation.goBack()} color={theme.text} />
          <Appbar.Content 
            title={`${tripDetails.name} Itinerary`} 
            titleStyle={[styles.appbarTitle, { color: theme.text }]}
            subtitleStyle={{ color: theme.subtext }}
          />
          {(userRole === 'admin' || userRole === 'editor') && (
            <Appbar.Action icon="refresh" onPress={fetchItinerary} color={theme.text} />
          )}
          <Appbar.Action icon="map" onPress={showFullMap} color={theme.text} />
        </Appbar.Header>

        {loading ? (
          <View style={[styles.loading, { backgroundColor: 'transparent' }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.text }]}>Loading...</Text>
          </View>
        ) : (
          <View style={styles.content}>
            {days.length > 0 ? (
              <>
                {renderDayTabs()}
                <View style={[styles.contentCard, { backgroundColor: theme.background }]}>
                  <DraggableFlatList
                    data={itinerary}
                    onDragEnd={handleDragEnd}
                    keyExtractor={item => item._id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContainer}
                    ListEmptyComponent={
                      <View style={styles.empty}>
                        <Icon name="calendar-blank" size={56} color={theme.primary} style={styles.emptyIcon} />
                        <Text style={[styles.emptyText, { color: theme.text }]}>No activities for this day</Text>
                        {(userRole === 'admin' || userRole === 'editor') && (
                          <LinearGradient
                            colors={[theme.primary, theme.accent]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.buttonGradient}
                          >
                            <Button
                              mode="contained"
                              icon="plus"
                              onPress={() => showDialog()}
                              style={styles.addButton}
                              contentStyle={styles.addButtonContent}
                              labelStyle={styles.buttonLabel}
                            >
                              Add Activity
                            </Button>
                          </LinearGradient>
                        )}
                      </View>
                    }
                  />
                </View>
              </>
            ) : (
              <View style={[styles.contentCard, { backgroundColor: theme.background }]}>
                <View style={styles.empty}>
                  <Icon name="calendar-alert" size={56} color={theme.primary} style={styles.emptyIcon} />
                  <Text style={[styles.emptyText, { color: theme.text }]}>Please set trip dates to plan itinerary.</Text>
                </View>
              </View>
            )}
            {(userRole === 'admin' || userRole === 'editor') && (
              <FAB
                style={styles.fab}
                icon="plus"
                onPress={() => showDialog()}
                color="#fff"
                theme={{ colors: { accent: theme.primary } }}
              />
            )}
          </View>
        )}

        <Portal>
          <Dialog visible={visible} onDismiss={hideDialog} style={[styles.dialog, { backgroundColor: theme.cardBackground }]}>
            <Dialog.Title style={[styles.dialogTitle, { color: theme.text }]}>
              {editingItem ? 'Edit Activity' : 'Add Activity'}
            </Dialog.Title>
            <Dialog.Content>
              <TextInput
                label="Title"
                value={itemValues.title}
                onChangeText={text => setItemValues({ ...itemValues, title: text })}
                style={[styles.input, { backgroundColor: theme.input }]}
                theme={{ colors: { primary: theme.primary, text: theme.text } }}
              />
              <TextInput
                label="Description"
                value={itemValues.description}
                onChangeText={text => setItemValues({ ...itemValues, description: text })}
                multiline
                style={[styles.input, { backgroundColor: theme.input }]}
                theme={{ colors: { primary: theme.primary, text: theme.text } }}
              />
              <TextInput
                label="Location"
                value={itemValues.location}
                onChangeText={text => setItemValues({ ...itemValues, location: text })}
                style={[styles.input, { backgroundColor: theme.input }]}
                theme={{ colors: { primary: theme.primary, text: theme.text } }}
              />
              <TouchableOpacity
                onPress={() => setShowTimePicker({ ...showTimePicker, start: true })}
                style={[styles.timeInput, { borderColor: theme.divider, backgroundColor: theme.input }]}
              >
                <Text style={[styles.timeInputText, { color: theme.text }]}>Start: {formatTime(itemValues.startTime)}</Text>
              </TouchableOpacity>
              {showTimePicker.start && (
                <DateTimePicker
                  value={itemValues.startTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => {
                    setShowTimePicker({ ...showTimePicker, start: false });
                    if (date) setItemValues({ ...itemValues, startTime: date });
                  }}
                />
              )}
              <TouchableOpacity
                onPress={() => setShowTimePicker({ ...showTimePicker, end: true })}
                style={[styles.timeInput, { borderColor: theme.divider, backgroundColor: theme.input }]}
              >
                <Text style={[styles.timeInputText, { color: theme.text }]}>End: {formatTime(itemValues.endTime)}</Text>
              </TouchableOpacity>
              {showTimePicker.end && (
                <DateTimePicker
                  value={itemValues.endTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, date) => {
                    setShowTimePicker({ ...showTimePicker, end: false });
                    if (date) setItemValues({ ...itemValues, endTime: date });
                  }}
                />
              )}
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={hideDialog} textColor={theme.subtext}>
                Cancel
              </Button>
              <LinearGradient
                colors={[theme.primary, theme.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.dialogButtonGradient}
              >
                <Button
                  onPress={handleSaveItem}
                  mode="contained"
                  style={styles.dialogButton}
                  contentStyle={styles.dialogButtonContent}
                  labelStyle={styles.buttonLabel}
                >
                  {editingItem ? 'Update' : 'Add'}
                </Button>
              </LinearGradient>
            </Dialog.Actions>
          </Dialog>

          <Modal visible={mapVisible} onDismiss={closeMap} contentContainerStyle={styles.mapContainer}>
            <View style={styles.mapWrapper}>
              <Appbar.Header style={[styles.mapAppbar, { backgroundColor: theme.primary }]}>
                <Appbar.BackAction onPress={closeMap} color="#fff" />
                <Appbar.Content 
                  title={selectedLocation ? selectedLocation.title : "Trip Locations"} 
                  titleStyle={styles.mapTitle} 
                />
              </Appbar.Header>
              
              <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_DEFAULT}
                initialRegion={getMapRegion()}
                region={getMapRegion()}
                minZoomLevel={2}
                maxZoomLevel={18}
              >
                {allLocationsWithCoordinates().map((item) => (
                  <Marker
                    key={item._id}
                    coordinate={{
                      latitude: item.coordinates.lat,
                      longitude: item.coordinates.lon,
                    }}
                    title={item.title}
                    description={`Day ${item.day}: ${item.location}`}
                    pinColor={selectedLocation && selectedLocation._id === item._id ? '#f44336' : theme.primary}
                  />
                ))}
              </MapView>
              
              {selectedLocation && selectedLocation.description && (
                <View style={[styles.locationInfoBox, { backgroundColor: theme.cardBackground }]}>
                  <Text style={[styles.locationInfoTitle, { color: theme.text }]}>{selectedLocation.title}</Text>
                  <Text style={[styles.locationInfoDescription, { color: theme.subtext }]}>{selectedLocation.description}</Text>
                  <Text style={[styles.locationInfoDetails, { color: theme.primary }]}>
                    {formatTime(selectedLocation.startTime)} - {formatTime(selectedLocation.endTime)}
                  </Text>
                </View>
              )}
            </View>
          </Modal>
        </Portal>
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
  appbar: {
    elevation: 0,
    marginTop: StatusBar.currentHeight || 0,
  },
  appbarTitle: {
    fontWeight: '700',
    fontSize: 22,
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
  },
  contentCard: {
    flex: 1,
    margin: 16,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
   
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  dayTabs: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
  },
  dayTabsContainer: {
    paddingHorizontal: 16,
  },
  dayTab: {
    marginRight: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  dayTabGradient: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  selectedDayTab: {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  itemCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  draggingItem: {
    opacity: 0.9,
    elevation: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemTime: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.25,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.25,
  },
  itemDescription: {
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
    letterSpacing: 0.15,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  locationIcon: {
    marginRight: 6,
  },
  itemLocation: {
    fontSize: 14,
    flex: 1,
  },
  mapButton: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
  },
  mapButtonGradient: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyIcon: {
    marginBottom: 16,
    opacity: 0.8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 0.25,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    backgroundColor: '#6200ea',
    borderRadius: 30,
  },
  buttonGradient: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  addButton: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 0,
    elevation: 0,
    backgroundColor: 'transparent',
  },
  addButtonContent: {
    paddingVertical: 6,
    height: 48,
  },
  buttonLabel: {
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#fff',
  },
  dialog: {
    borderRadius: 24,
    elevation: 24,
    overflow: 'hidden',
    padding: 8,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.15,
  },
  input: {
    marginBottom: 16,
    borderRadius: 8,
  },
  timeInput: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  timeInputText: {
    fontSize: 16,
  },
  dialogButton: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    elevation: 0,
    borderWidth: 0,
  },
  dialogButtonContent: {
    paddingHorizontal: 16,
  },
  dialogButtonGradient: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  mapContainer: {
    flex: 1,
    margin: 0,
    padding: 0,
    justifyContent: 'flex-end',
  },
  mapWrapper: {
    height: height,
    width: width,
    backgroundColor: '#fff',
  },
  mapAppbar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: '#6200ea',
    elevation: 4,
  },
  mapTitle: {
    color: '#fff',
    fontWeight: '600',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    marginTop: Platform.OS === 'ios' ? 44 : 56,
  },
  locationInfoBox: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    padding: 16,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  locationInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  locationInfoDescription: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  locationInfoDetails: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ItineraryScreen;