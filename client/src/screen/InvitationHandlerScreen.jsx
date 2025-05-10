import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  Linking, 
  ImageBackground,
  StatusBar,
  useColorScheme
} from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../apis/api';

const InvitationHandlerScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invitationData, setInvitationData] = useState(null);
  const [userLoggedIn, setUserLoggedIn] = useState(false);
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
  };
  
  const { tripId, email } = route.params || {};
  
  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        setUserLoggedIn(!!token);
      } catch (err) {
        console.error('Error checking authentication:', err);
      }
    };
    
    checkUserStatus();
  }, []);
  
  useEffect(() => {
    if (tripId && email) {
      handleInvitation();
    } else {
      Linking.getInitialURL().then(url => {
        if (url) {
          const params = extractParamsFromUrl(url);
          if (params.tripId && params.email) {
            navigation.setParams(params);
          } else {
            setLoading(false);
            setError('Invalid invitation link');
          }
        } else {
          setLoading(false);
          setError('Invalid invitation link');
        }
      }).catch(err => {
        console.error('Error getting initial URL:', err);
        setLoading(false);
        setError('Failed to process invitation link');
      });
    }
  }, [tripId, email]);
  
  const extractParamsFromUrl = (url) => {
    const params = {};
    try {
      const match = url.match(/invite\/([^\/]+)\/([^\/]+)$/);
      if (match && match[1] && match[2]) {
        params.tripId = match[1];
        params.email = decodeURIComponent(match[2]);
      }
    } catch (error) {
      console.error('Error parsing URL parameters:', error);
    }
    return params;
  };
  
  const handleInvitation = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.acceptInvitation(tripId, email);
      
      if (response.success) {
        setInvitationData(response.data);
        
        if (response.data.requiresAuth && !userLoggedIn) {
          await AsyncStorage.setItem('pendingInvitationEmail', email);
          await AsyncStorage.setItem('pendingInvitationTripId', tripId);
        } else {
          navigation.reset({
            index: 1,
            routes: [
              { name: 'Dashboard' },
              { name: 'TripDetails', params: { tripId } }
            ]
          });
        }
      } else {
        setError(response.error || 'Failed to process invitation');
      }
    } catch (err) {
      console.error('Invitation handling error:', err);
      setError('Failed to process invitation');
    } finally {
      setLoading(false);
    }
  };
  
  const navigateToLogin = () => {
    navigation.navigate('Login', { redirectAfter: 'pendingInvitation' });
  };
  
  const navigateToSignup = () => {
    navigation.navigate('Signup', { redirectAfter: 'pendingInvitation', email });
  };
  
  if (loading) {
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
          <View style={[styles.loadingCard, { backgroundColor: theme.background }]}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.text }]}>Processing invitation...</Text>
          </View>
        </SafeAreaView>
      </ImageBackground>
    );
  }
  
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
        <View style={[styles.contentCard, { backgroundColor: theme.background }]}>
          <View style={styles.headerSection}>
            <Icon name="airplane" size={36} color={theme.primary} style={styles.headerIcon} />
            <Text style={[styles.title, { color: theme.text }]}>Trip Invitation</Text>
          </View>
          
          {error ? (
            <View style={styles.messageContainer}>
              <Icon name="alert-circle" size={48} color={theme.error} style={styles.statusIcon} />
              <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
            </View>
          ) : invitationData?.requiresAuth ? (
            <View style={styles.messageContainer}>
              <Icon name="email-check" size={48} color={theme.primary} style={styles.statusIcon} />
              <Text style={[styles.message, { color: theme.text }]}>
                You've been invited to join "{invitationData.tripName}"
              </Text>
              <Text style={[styles.subMessage, { color: theme.subtext }]}>
                Please log in or create an account to view this trip.
              </Text>
              <LinearGradient
                colors={['rgba(98, 0, 234, 0.8)', 'rgba(3, 218, 198, 0.8)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Button 
                  mode="contained" 
                  onPress={navigateToLogin}
                  style={styles.gradientButton}
                  labelStyle={styles.buttonLabel}
                >
                  Log In
                </Button>
              </LinearGradient>
              <Button 
                mode="outlined" 
                onPress={navigateToSignup}
                style={[styles.outlinedButton, { borderColor: theme.primary }]}
                labelStyle={[styles.outlinedButtonLabel, { color: theme.primary }]}
              >
                Create Account
              </Button>
            </View>
          ) : (
            <View style={styles.messageContainer}>
              <Icon name="check-circle" size={48} color={theme.accent} style={styles.statusIcon} />
              <Text style={[styles.message, { color: theme.text }]}>
                Successfully joined "{invitationData?.tripName}"
              </Text>
              <LinearGradient
                colors={['rgba(98, 0, 234, 0.8)', 'rgba(3, 218, 198, 0.8)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Button 
                  mode="contained" 
                  onPress={() => navigation.navigate('TripDetails', { tripId })}
                  style={styles.gradientButton}
                  labelStyle={styles.buttonLabel}
                >
                  View Trip
                </Button>
              </LinearGradient>
            </View>
          )}
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
    padding: 16,
    justifyContent: 'center',
  },
  loadingCard: {
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontFamily: 'Roboto',
    textAlign: 'center',
  },
  contentCard: {
    padding: 24,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerIcon: {
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'Tagesschrift',
  },
  messageContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  statusIcon: {
    marginBottom: 16,
  },
  message: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'Roboto',
  },
  subMessage: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: 'Roboto',
  },
  errorText: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: 'Roboto',
  },
  buttonGradient: {
    borderRadius: 30,
    width: '100%',
    marginVertical: 8,
    elevation: 4,
  },
  gradientButton: {
    height: 50,
    justifyContent: 'center',
    borderRadius: 30,
    backgroundColor: 'transparent',
    elevation: 0,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Roboto',
  },
  outlinedButton: {
    marginTop: 12,
    width: '100%',
    height: 50,
    justifyContent: 'center',
    borderRadius: 30,
    borderWidth: 2,
  },
  outlinedButtonLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Roboto',
  },
});

export default InvitationHandlerScreen;