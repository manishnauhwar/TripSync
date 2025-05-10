import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  Alert,
  ImageBackground,
  StatusBar,
  Dimensions,
  useColorScheme
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, TextInput, Button, RadioButton, Card, Avatar, IconButton } from 'react-native-paper';
import { LinearGradient } from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import api from '../apis/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const InviteParticipantsScreen = ({ route, navigation }) => {
  const { tripId, tripName } = route.params;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

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
    const checkUserRole = async () => {
      try {
        const userData = await AsyncStorage.getItem('userDetails');
        if (userData) {
          const user = JSON.parse(userData);
          
          const tripResponse = await api.getTripById(tripId);
          if (tripResponse.success) {
            const participant = tripResponse.data.data.participants.find(
              p => p.email === user.email
            );
            
            if (participant && participant.role === 'admin') {
              setIsAdmin(true);
            }
          }
        }
      } catch (err) {
        console.error('Error checking user role:', err);
      }
    };
    
    checkUserRole();
  }, [tripId]);

  const handleInvite = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Non-admin users can only invite with viewer role
      const inviteRole = isAdmin ? role : 'viewer';
      const response = await api.inviteToTrip(tripId, email.trim(), inviteRole);
      
      if (response.success) {
        setSuccess(true);
        setEmail('');
        Alert.alert(
          'Success',
          `Invitation sent to ${email.trim()}`,
          [{ text: 'OK' }]
        );
      } else {
        setError(response.error);
      }
    } catch (err) {
      setError('Failed to send invitation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewTrip = () => {
    navigation.navigate('TripDetails', { tripId });
  };

  const handleFinish = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Dashboard' }],
    });
  };

  const getRoleDisplayInfo = (roleValue) => {
    switch(roleValue) {
      case 'admin':
        return {
          title: 'Creator',
          description: 'Full control over trip details and participants',
          color: theme.primary,
          icon: 'crown'
        };
      case 'editor':
        return {
          title: 'Editor',
          description: 'Can Manage Trip Details',
          color: '#03a9f4',
          icon: 'account-edit'
        };
      case 'viewer':
        return {
          title: 'Viewer',
          description: 'Only a Participant of Trip',
          color: '#9e9e9e',
          icon: 'account-eye'
        };
      default:
        return {
          title: 'Unknown',
          // description: '',
          color: '#9e9e9e',
          icon: 'account-question'
        };
    }
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
        <Appbar.Header style={[styles.appbar, { backgroundColor: 'transparent' }]}>
          <Appbar.BackAction color={theme.text} onPress={() => navigation.goBack()} />
          <Appbar.Content 
            title="Invite Participants" 
            subtitle={tripName} 
            titleStyle={[styles.appbarTitle, { color: theme.text }]}
            subtitleStyle={[styles.appbarSubtitle, { color: theme.subtext }]}
          />
        </Appbar.Header>

        <ScrollView style={styles.scrollView}>
          <View style={[styles.contentCard, { backgroundColor: theme.background }]}>
            <View style={styles.headerSection}>
              <Icon name="account-group" size={36} color={theme.primary} style={styles.headerIcon} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Add participants to your trip</Text>
             
            </View>

            <View style={styles.formSection}>
              <TextInput
                label="Email Address"
                value={email}
                onChangeText={setEmail}
                style={[styles.input]}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
                theme={{ colors: { primary: theme.primary } }}
                left={<TextInput.Icon name="email" color={theme.primary} />}
              />

              {isAdmin && (
                <>
                  <Text style={[styles.roleTitle, { color: theme.text }]}>Select Role:</Text>
                  
                  <RadioButton.Group onValueChange={value => setRole(value)} value={role}>
                    {['editor', 'viewer'].map((roleValue) => {
                      const roleInfo = getRoleDisplayInfo(roleValue);
                      return (
                        <Card 
                          key={roleValue} 
                          style={[
                            styles.roleCard, 
                            { backgroundColor: theme.cardBackground },
                            role === roleValue && [
                              styles.selectedRoleCard, 
                              { borderColor: theme.primary }
                            ]
                          ]}
                        >
                          <Card.Content style={styles.roleCardContent}>
                            <View style={styles.roleLeftContent}>
                              <RadioButton.Android 
                                value={roleValue} 
                                color={theme.primary} 
                                uncheckedColor={theme.subtext}
                              />
                              <View style={styles.roleTextContainer}>
                                <Text style={[styles.roleTextTitle, { color: theme.text }]}>{roleInfo.title}</Text>
                                <Text style={[styles.roleTextDescription, { color: theme.subtext }]}>
                                  {roleInfo.description}
                                </Text>
                              </View>
                            </View>
                            <Icon name={roleInfo.icon} size={28} color={roleInfo.color} />
                          </Card.Content>
                        </Card>
                      );
                    })}
                  </RadioButton.Group>
                </>
              )}

              {!isAdmin && (
                <View style={[styles.viewerRoleInfo, { backgroundColor: theme.cardBackground }]}>
                  <Icon name="information" size={22} color={theme.primary} style={styles.infoIcon} />
                  <Text style={[styles.viewerRoleText, { color: theme.subtext }]}>
                    Invited users will join as Viewers and can only view trip details
                  </Text>
                </View>
              )}

              {error && (
                <View style={styles.errorContainer}>
                  <Icon name="alert-circle" size={18} color={theme.error} style={styles.errorIcon} />
                  <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
                </View>
              )}

              {success && (
                <View style={styles.successContainer}>
                  <Icon name="check-circle" size={18} color={theme.success} style={styles.successIcon} />
                  <Text style={[styles.successText, { color: theme.success }]}>
                    Invitation sent successfully!
                  </Text>
                </View>
              )}

              <LinearGradient
                colors={[theme.primary, theme.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                <Button 
                  mode="contained" 
                  onPress={handleInvite}
                  style={styles.gradientButton}
                  labelStyle={styles.buttonLabel}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" size="small" /> : 'Send Invitation'}
                </Button>
              </LinearGradient>
              
              <View style={styles.buttonContainer}>
                <Button 
                  mode="outlined" 
                  onPress={handleViewTrip}
                  style={[styles.secondaryButton, { borderColor: theme.primary }]}
                  labelStyle={[styles.secondaryButtonLabel, { color: theme.primary }]}
                  icon="map-marker"
                >
                  View Trip
                </Button>
                
                <Button 
                  mode="outlined" 
                  onPress={handleFinish}
                  style={[styles.secondaryButton, { borderColor: theme.primary }]}
                  labelStyle={[styles.secondaryButtonLabel, { color: theme.primary }]}
                  icon="check"
                >
                  Finish
                </Button>
              </View>
            </View>
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
  appbarSubtitle: {
    fontSize: 16,
    letterSpacing: 0.25,
  },
  scrollView: {
    flex: 1,
  },
  contentCard: {
    margin: 16,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  headerSection: {
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  headerIcon: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    // marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  sectionDescription: {
    fontSize: 17,
    lineHeight: 24,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.15,
  },
  formSection: {
    padding: 24,
  },
  input: {
    marginBottom: 28,
    borderRadius: 12,
    height: 60,
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 18,
    letterSpacing: 0.25,
  },
  roleCard: {
    marginBottom: 14,
    elevation: 2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedRoleCard: {
    borderWidth: 2,
    elevation: 4,
  },
  roleCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  roleLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  roleTextContainer: {
    marginLeft: 12,
  },
  roleTextTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.25,
  },
  roleTextDescription: {
    fontSize: 15,
    marginTop: 4,
    lineHeight: 20,
    letterSpacing: 0.15,
  },
  viewerRoleInfo: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(3, 218, 198, 0.3)',
  },
  infoIcon: {
    marginRight: 12,
  },
  viewerRoleText: {
    fontSize: 15,
    flex: 1,
    lineHeight: 21,
    letterSpacing: 0.15,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 18,
    backgroundColor: 'rgba(207, 102, 121, 0.1)',
    padding: 12,
    borderRadius: 8,
  },
  errorIcon: {
    marginRight: 10,
  },
  errorText: {
    fontSize: 15,
    letterSpacing: 0.15,
    fontWeight: '500',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // marginTop: 12,
    // marginBottom: 18,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    padding: 12,
    borderRadius: 8,
  },
  successIcon: {
    marginRight: 10,
  },
  successText: {
    fontSize: 15,
    letterSpacing: 0.15,
    fontWeight: '500',
  },
  buttonGradient: {
    borderRadius: 30,
    marginTop: 28,
    elevation: 6,
  },
  gradientButton: {
    height: 56,
    justifyContent: 'center',
    borderRadius: 30,
    backgroundColor: 'transparent',
    elevation: 0,
  },
  buttonLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.75,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  secondaryButton: {
    flex: 1,
    marginHorizontal: 6,
    height: 50,
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 30,
  },
  secondaryButtonLabel: {
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});

export default InviteParticipantsScreen;