import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Platform,
  Alert,
  ImageBackground,
  useColorScheme,
  StatusBar,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, TextInput, Button, ActivityIndicator } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../apis/api';

const { width, height } = Dimensions.get('window');

const CreateTripScreen = ({ navigation }) => {
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
    inputBackground: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : '#FFFFFF',
  };

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

  const goBack = () => {
    navigation.goBack();
  };

  const hideDatePicker = () => {
    setDatePickerConfig(prev => ({...prev, show: false}));
  };

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
        <Appbar.Header style={[styles.appBar, { backgroundColor: theme.primary }]}>
          <Appbar.BackAction color="#fff" onPress={goBack} />
          <Appbar.Content title="Create Trip" titleStyle={styles.headerTitle} />
        </Appbar.Header>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollViewContent}
        >
          <View style={[styles.formContainer, { backgroundColor: theme.background }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Trip Details</Text>
            
            <TextInput
              label="Trip Name *"
              value={tripData.name}
              onChangeText={(text) => setTripData(prev => ({...prev, name: text}))}
              style={styles.input}
              mode="outlined"
              outlineColor={theme.divider}
              activeOutlineColor={theme.primary}
              theme={{ 
                colors: { 
                  text: theme.text,
                  placeholder: theme.subtext,
                  background: theme.inputBackground
                } 
              }}
            />

            <TextInput
              label="Description"
              value={tripData.description}
              onChangeText={(text) => setTripData(prev => ({...prev, description: text}))}
              multiline
              numberOfLines={4}
              style={styles.input}
              mode="outlined"
              outlineColor={theme.divider}
              activeOutlineColor={theme.primary}
              theme={{ 
                colors: { 
                  text: theme.text,
                  placeholder: theme.subtext,
                  background: theme.inputBackground
                } 
              }}
            />
            
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Trip Dates</Text>

            <TouchableOpacity 
              onPress={() => showDatePicker('start')}
              style={[styles.datePickerButton, { borderColor: theme.divider, backgroundColor: theme.inputBackground }]}
            >
              <Text style={[styles.datePickerLabel, { color: theme.text }]}>Start Date</Text>
              <Text style={[styles.dateText, { color: theme.primary }]}>
                {formatDate(tripData.startDate)}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => showDatePicker('end')}
              style={[styles.datePickerButton, { borderColor: theme.divider, backgroundColor: theme.inputBackground }]}
            >
              <Text style={[styles.datePickerLabel, { color: theme.text }]}>End Date</Text>
              <Text style={[styles.dateText, { color: theme.primary }]}>
                {formatDate(tripData.endDate)}
              </Text>
            </TouchableOpacity>
            
            {datePickerConfig.show && (
              <>
                {Platform.OS === 'ios' && (
                  <View style={[styles.iosPickerContainer, { 
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.divider 
                  }]}>
                    <View style={[styles.iosPickerHeader, { 
                      borderBottomColor: theme.divider,
                      backgroundColor: theme.cardBackground 
                    }]}>
                      <TouchableOpacity onPress={hideDatePicker}>
                        <Text style={[styles.iosPickerDoneBtn, { color: theme.primary }]}>Done</Text>
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
                      textColor={theme.text}
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
                    themeVariant={isDarkMode ? 'dark' : 'light'}
                  />
                )}
              </>
            )}

            {error && (
              <View style={[styles.errorContainer, { borderLeftColor: theme.error }]}>
                <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
              </View>
            )}

            <Button 
              mode="contained" 
              onPress={handleCreateTrip}
              style={[styles.button, { backgroundColor: theme.primary }]}
              disabled={loading}
              labelStyle={styles.buttonLabel}
            >
              {loading ? 'Creating...' : 'Create Trip'}
            </Button>
            
            {loading && (
              <ActivityIndicator 
                color={theme.primary} 
                size="large" 
                style={styles.loader}
              />
            )}
            
            <Button 
              mode="outlined" 
              onPress={goBack}
              style={[styles.cancelButton, { borderColor: theme.primary }]}
              disabled={loading}
              labelStyle={[styles.cancelButtonLabel, { color: theme.primary }]}
            >
              Cancel
            </Button>
          </View>
        </ScrollView>
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
    margin: 16,
    
  },
  appBar: {
    // textAlign:"center",
    // alignItems:"center",
    elevation: 0,
    borderRadius: 24,
    // margin: 10,
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
    paddingBottom: 20,
  },
  formContainer: {
    marginTop: 20,
    padding: 20,
    borderRadius: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8,
  },
  input: {
    marginBottom: 16,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 4,
    borderWidth: 1,
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
  },
  dateText: {
    fontSize: 16,
  },
  errorContainer: {
    backgroundColor: 'rgba(211, 47, 47, 0.1)',
    padding: 12,
    borderRadius: 4,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  errorText: {
    fontWeight: '500',
  },
  button: {
    marginTop: 8,
    paddingVertical: 8,
    borderRadius: 30,
    elevation: 2,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    paddingVertical: 4,
    color: '#fff',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 8,
    borderRadius: 30,
  },
  cancelButtonLabel: {
    fontSize: 16,
    paddingVertical: 4,
  },
  loader: {
    marginTop: 20,
  },
  iosPickerContainer: {
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 12,
    borderBottomWidth: 1,
  },
  iosPickerDoneBtn: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  iosPicker: {
    height: 200,
  },
});

export default CreateTripScreen;