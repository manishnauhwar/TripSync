import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Linking } from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../apis/api';

const InvitationHandlerScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [invitationData, setInvitationData] = useState(null);
  const [userLoggedIn, setUserLoggedIn] = useState(false);
  
  const { tripId, email } = route.params || {};
  
  useEffect(() => {
    console.log('InvitationHandler mounted - params:', { tripId, email });
    
    const checkUserStatus = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        setUserLoggedIn(!!token);
        console.log('User logged in status:', !!token);
      } catch (err) {
        console.error('Error checking authentication:', err);
      }
    };
    
    checkUserStatus();
  }, []);
  
  useEffect(() => {
    if (tripId && email) {
      console.log('Handling invitation with tripId and email:', { tripId, email });
      handleInvitation();
    } else {
      console.log('Missing tripId or email, checking URL...');
      Linking.getInitialURL().then(url => {
        if (url) {
          console.log('Got URL from Linking:', url);
          const params = extractParamsFromUrl(url);
          if (params.tripId && params.email) {
            console.log('Extracted params from URL:', params);
            navigation.setParams(params);
          } else {
            setLoading(false);
            setError('Invalid invitation link. Missing trip ID or email.');
          }
        } else {
          setLoading(false);
          setError('Invalid invitation link. Missing trip ID or email.');
        }
      }).catch(err => {
        console.error('Error getting initial URL:', err);
        setLoading(false);
        setError('Failed to process invitation link.');
      });
    }
  }, [tripId, email]);
  
  const extractParamsFromUrl = (url) => {
    const params = {};
    try {
      const match = url.match(/invite\?(.*)$/);
      if (match && match[1]) {
        const queryParams = match[1].split('&');
        queryParams.forEach(param => {
          const [key, value] = param.split('=');
          if (key && value) {
            params[key] = key === 'email' ? decodeURIComponent(value) : value;
          }
        });
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
      console.log('Accepting invitation:', { tripId, email });
      const response = await api.acceptInvitation(tripId, email);
      console.log('Invitation response:', response);
      
      if (response.success) {
        setInvitationData(response.data);
        
        if (response.data.requiresAuth && !userLoggedIn) {
          console.log('Auth required, storing pending invitation data');
          await AsyncStorage.setItem('pendingInvitationEmail', email);
          await AsyncStorage.setItem('pendingInvitationTripId', tripId);
        } else {
          console.log('User logged in, navigating to trip details');
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
      setError('Failed to process invitation. Please try again.');
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
  
  const downloadApp = async () => {
    try {
      const downloadUrl = 'https://yourhost.com/download/tripsync.apk'; 
      await Linking.openURL(downloadUrl);
    } catch (error) {
      console.error('Failed to open download link:', error);
      setError('Could not open download link. Please try again.');
    }
  };
  
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200ea" />
          <Text style={styles.loadingText}>Processing invitation...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Trip Invitation</Text>
        
        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <Button 
              mode="contained" 
              onPress={() => navigation.navigate('Dashboard')}
              style={styles.button}
            >
              Go to Dashboard
            </Button>
          </View>
        ) : invitationData?.requiresAuth ? (
          <View style={styles.actionContainer}>
            <Text style={styles.message}>
              You've been invited to join "{invitationData.tripName}"
            </Text>
            <Text style={styles.subMessage}>
              Please log in or create an account to view this trip.
            </Text>
            <Button 
              mode="contained" 
              onPress={navigateToLogin}
              style={[styles.button, styles.loginButton]}
            >
              Log In
            </Button>
            <Button 
              mode="outlined" 
              onPress={navigateToSignup}
              style={styles.button}
            >
              Create Account
            </Button>
          </View>
        ) : (
          <View style={styles.successContainer}>
            <Text style={styles.message}>
              Successfully joined "{invitationData?.tripName}"
            </Text>
            <Button 
              mode="contained" 
              onPress={() => navigation.navigate('TripDetails', { tripId })}
              style={styles.button}
            >
              View Trip
            </Button>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#6200ea',
  },
  errorContainer: {
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  actionContainer: {
    width: '100%',
    alignItems: 'center',
  },
  successContainer: {
    alignItems: 'center',
  },
  message: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  subMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    marginTop: 10,
    width: '100%',
    paddingVertical: 6,
  },
  loginButton: {
    backgroundColor: '#6200ea',
  },
});

export default InvitationHandlerScreen; 