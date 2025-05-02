import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, TextInput, Button, ActivityIndicator } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../apis/api';

const CreateTripScreen = ({ navigation }) => {
  const [tripData, setTripData] = useState({
    name: '',
    description: '',
    startDate: new Date(),
    endDate: new Date(new Date().setDate(new Date().getDate() + 1)),
  });

  const [datePickerConfig, setDatePickerConfig] = useState({
    show: false,
    mode: 'start',
    currentDate: new Date()
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const showDatePicker = (mode) => {
    const date = mode === 'start' ? tripData.startDate : tripData.endDate;
    setDatePickerConfig({
      show: true,
      mode: mode,
      currentDate: date
    });
  };

  const onDateChange = (event, selectedDate) => {
    const { mode } = datePickerConfig;
    
    if (Platform.OS === 'android') {
      setDatePickerConfig(prev => ({...prev, show: false}));
    }
    
    if (!selectedDate) return;
    
    if (mode === 'start') {
      setTripData(prev => {
        const newEndDate = selectedDate > prev.endDate 
          ? new Date(selectedDate) 
          : prev.endDate;
          
        return {
          ...prev,
          startDate: selectedDate,
          endDate: newEndDate
        };
      });
    } else {
      setTripData(prev => ({...prev, endDate: selectedDate}));
    }
  };

  const handleCreateTrip = async () => {
    if (!tripData.name.trim()) {
      setError('Trip name is required');
      return;
    }

    if (tripData.endDate < tripData.startDate) {
      setError('End date cannot be before start date');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.createTrip(tripData);
      
      if (response.success) {
        navigation.navigate('InviteParticipants', { 
          tripId: response.data.data._id,
          tripName: response.data.data.name 
        });
      } else {
        setError(response.error || 'Failed to create trip');
      }
    } catch (err) {
      console.error('Create trip error:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const hideDatePicker = () => {
    setDatePickerConfig(prev => ({...prev, show: false}));
  };

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header style={styles.appBar}>
        <Appbar.BackAction color="#fff" onPress={() => navigation.goBack()} />
        <Appbar.Content title="Create Trip" titleStyle={styles.headerTitle} />
      </Appbar.Header>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollViewContent}>
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Trip Details</Text>
          
          <TextInput
            label="Trip Name *"
            value={tripData.name}
            onChangeText={(text) => setTripData(prev => ({...prev, name: text}))}
            style={styles.input}
            mode="outlined"
            outlineColor="#ddd"
            activeOutlineColor="#6200ea"
          />

          <TextInput
            label="Description"
            value={tripData.description}
            onChangeText={(text) => setTripData(prev => ({...prev, description: text}))}
            multiline
            numberOfLines={4}
            style={styles.input}
            mode="outlined"
            outlineColor="#ddd"
            activeOutlineColor="#6200ea"
          />
          
          <Text style={styles.sectionTitle}>Trip Dates</Text>

          <TouchableOpacity 
            onPress={() => showDatePicker('start')}
            style={styles.datePickerButton}
          >
            <Text style={styles.datePickerLabel}>Start Date</Text>
            <Text style={styles.dateText}>
              {formatDate(tripData.startDate)}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => showDatePicker('end')}
            style={styles.datePickerButton}
          >
            <Text style={styles.datePickerLabel}>End Date</Text>
            <Text style={styles.dateText}>
              {formatDate(tripData.endDate)}
            </Text>
          </TouchableOpacity>
          
          {datePickerConfig.show && (
            <>
              {Platform.OS === 'ios' && (
                <View style={styles.iosPickerContainer}>
                  <View style={styles.iosPickerHeader}>
                    <TouchableOpacity onPress={hideDatePicker}>
                      <Text style={styles.iosPickerDoneBtn}>Done</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <DateTimePicker
                    value={datePickerConfig.currentDate}
                    mode="date"
                    display="spinner"
                    onChange={onDateChange}
                    minimumDate={
                      datePickerConfig.mode === 'end' ? tripData.startDate : new Date()
                    }
                    style={styles.iosPicker}
                  />
                </View>
              )}
              
              {Platform.OS === 'android' && (
                <DateTimePicker
                  value={datePickerConfig.currentDate}
                  mode="date"
                  display="default"
                  onChange={onDateChange}
                  minimumDate={
                    datePickerConfig.mode === 'end' ? tripData.startDate : new Date()
                  }
                />
              )}
            </>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Button 
            mode="contained" 
            onPress={handleCreateTrip}
            style={styles.button}
            disabled={loading}
            labelStyle={styles.buttonLabel}
          >
            {loading ? 'Creating...' : 'Create Trip'}
          </Button>
          
          {loading && (
            <ActivityIndicator 
              color="#6200ea" 
              size="large" 
              style={styles.loader}
            />
          )}
          
          <Button 
            mode="outlined" 
            onPress={() => navigation.goBack()}
            style={styles.cancelButton}
            disabled={loading}
            labelStyle={styles.cancelButtonLabel}
          >
            Cancel
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  appBar: {
    backgroundColor: '#6200ea',
  },
  headerTitle: {
    color: '#fff',
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  formContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8,
    color: '#333',
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  datePickerLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  dateText: {
    fontSize: 16,
    color: '#6200ea',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#d32f2f',
  },
  errorText: {
    color: '#d32f2f',
  },
  button: {
    marginTop: 8,
    paddingVertical: 8,
    backgroundColor: '#6200ea',
    borderRadius: 4,
    elevation: 2,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    paddingVertical: 4,
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 8,
    borderColor: '#6200ea',
  },
  cancelButtonLabel: {
    color: '#6200ea',
    fontSize: 16,
    paddingVertical: 4,
  },
  loader: {
    marginTop: 20,
  },
  iosPickerContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    backgroundColor: '#fff',
  },
  iosPickerDoneBtn: {
    color: '#6200ea',
    fontSize: 16,
    fontWeight: 'bold',
  },
  iosPicker: {
    height: 200,
  },
});

export default CreateTripScreen;