import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, Button, Card, Dialog, Portal, TextInput, IconButton, FAB } from 'react-native-paper';
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
    endTime: new Date(Date.now() + 3600000),
  });
  const [userRole, setUserRole] = useState('viewer');
  const [showTimePicker, setShowTimePicker] = useState({ start: false, end: false });

  useEffect(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
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
  }, [startDate, endDate]);

  useFocusEffect(
    useCallback(() => {
      fetchItinerary();
    }, [tripId])
  );

  const fetchItinerary = async () => {
    setLoading(true);
    try {
      const response = await api.getItinerary(tripId);
      if (response.success) {
        const items = Array.isArray(response.data?.data?.data)
          ? response.data.data.data
          : Array.isArray(response.data)
            ? response.data
            : [];
        setItinerary(items);

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

      for (let i = 0; i < reorderedItems.length; i++) {
        const item = reorderedItems[i];
        const duration = new Date(item.endTime) - new Date(item.startTime);
        if (i > 0) {
          const prevEndTime = new Date(reorderedItems[i - 1].endTime);
          item.startTime = prevEndTime;
          item.endTime = new Date(prevEndTime.getTime() + duration);
        }
      }

      setItinerary(prev => [...prev.filter(item => item.day !== selectedDay), ...reorderedItems]);
      const itemsForUpdate = reorderedItems.map((item, index) => ({
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
            style={[styles.dayTab, selectedDay === item.day && styles.selectedDayTab]}
            onPress={() => setSelectedDay(item.day)}
          >
            <Text style={[styles.dayText, selectedDay === item.day && styles.selectedDayText]}>
              Day {item.day} ({new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
            </Text>
          </TouchableOpacity>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayTabsContainer}
      />
    </View>
  );

  const renderItem = useCallback(
    ({ item, drag, isActive }) => {
      if (item.day !== selectedDay) return null;
      return (
        <Card style={[styles.itemCard, isActive && styles.draggingItem]} elevation={3}>
          <Card.Content>
            <View style={styles.itemHeader}>
              <Text style={styles.itemTime}>
                {formatTime(item.startTime)} - {formatTime(item.endTime)}
              </Text>
              {(userRole === 'admin' || userRole === 'editor') && (
                <View style={styles.itemActions}>
                  <IconButton icon="pencil" size={20} iconColor="#6200ee" onPress={() => showDialog(item)} />
                  <IconButton icon="delete" size={20} iconColor="#f44336" onPress={() => handleDeleteItem(item._id)} />
                  <IconButton icon="drag" size={20} iconColor="#757575" onLongPress={drag} />
                </View>
              )}
            </View>
            <Text style={styles.itemTitle}>{item.title}</Text>
            {item.description && <Text style={styles.itemDescription}>{item.description}</Text>}
            {item.location && (
              <View style={styles.locationContainer}>
                <Text style={styles.itemLocation}>📍 {item.location}</Text>
              </View>
            )}
          </Card.Content>
        </Card>
      );
    },
    [selectedDay, userRole]
  );

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header style={styles.appbar}>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
        <Appbar.Content title={`${tripName} Itinerary`} titleStyle={styles.appbarTitle} />
        {(userRole === 'admin' || userRole === 'editor') && (
          <Appbar.Action icon="refresh" onPress={fetchItinerary} color="#fff" />
        )}
      </Appbar.Header>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <View style={styles.content}>
          {days.length > 0 ? (
            <>
              {renderDayTabs()}
              <DraggableFlatList
                data={itinerary}
                onDragEnd={handleDragEnd}
                keyExtractor={item => item._id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>No activities for this day</Text>
                    {(userRole === 'admin' || userRole === 'editor') && (
                      <Button
                        mode="contained"
                        icon="plus"
                        onPress={() => showDialog()}
                        style={styles.addButton}
                        contentStyle={styles.addButtonContent}
                      >
                        Add Activity
                      </Button>
                    )}
                  </View>
                }
              />
            </>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Please set trip dates to plan itinerary.</Text>
            </View>
          )}
          {(userRole === 'admin' || userRole === 'editor') && (
            <FAB style={styles.fab} icon="plus" onPress={() => showDialog()} color="#fff" />
          )}
        </View>
      )}

      <Portal>
        <Dialog visible={visible} onDismiss={hideDialog} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>
            {editingItem ? 'Edit Activity' : 'Add Activity'}
          </Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Title"
              value={itemValues.title}
              onChangeText={text => setItemValues({ ...itemValues, title: text })}
              style={styles.input}
              theme={{ colors: { primary: '#6200ee' } }}
            />
            <TextInput
              label="Description"
              value={itemValues.description}
              onChangeText={text => setItemValues({ ...itemValues, description: text })}
              multiline
              style={styles.input}
              theme={{ colors: { primary: '#6200ee' } }}
            />
            <TextInput
              label="Location"
              value={itemValues.location}
              onChangeText={text => setItemValues({ ...itemValues, location: text })}
              style={styles.input}
              theme={{ colors: { primary: '#6200ee' } }}
            />
            <TouchableOpacity
              onPress={() => setShowTimePicker({ ...showTimePicker, start: true })}
              style={styles.timeInput}
            >
              <Text style={styles.timeInputText}>Start: {formatTime(itemValues.startTime)}</Text>
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
              style={styles.timeInput}
            >
              <Text style={styles.timeInputText}>End: {formatTime(itemValues.endTime)}</Text>
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
            <Button onPress={hideDialog} textColor="#757575">
              Cancel
            </Button>
            <Button
              onPress={handleSaveItem}
              mode="contained"
              style={styles.dialogButton}
              contentStyle={styles.dialogButtonContent}
            >
              {editingItem ? 'Update' : 'Add'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  appbar: {
    paddingTop: 10,
    marginTop: 0,
    backgroundColor: '#6200ee',
    elevation: 4,
  },
  appbarTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
  dayTabs: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dayTabsContainer: {
    paddingHorizontal: 16,
  },
  dayTab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f1f3f5',
  },
  selectedDayTab: {
    backgroundColor: '#6200ee',
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
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  draggingItem: {
    opacity: 0.9,
    shadowOpacity: 0.3,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemTime: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6200ee',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemLocation: {
    fontSize: 14,
    color: '#f44336',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 16,
  },
  addButton: {
    borderRadius: 8,
    backgroundColor: '#6200ee',
  },
  addButtonContent: {
    paddingHorizontal: 16,
    height: 48,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#6200ee',
    elevation: 6,
  },
  dialog: {
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  input: {
    marginBottom: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  timeInput: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#f8fafc',
  },
  timeInputText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  dialogButton: {
    borderRadius: 8,
    backgroundColor: '#6200ee',
  },
  dialogButtonContent: {
    paddingHorizontal: 16,
    height: 48,
  },
});

export default ItineraryScreen;