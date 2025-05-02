import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, TextInput, Button, RadioButton, Card, Avatar } from 'react-native-paper';
import api from '../apis/api';

const InviteParticipantsScreen = ({ route, navigation }) => {
  const { tripId, tripName } = route.params;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleInvite = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await api.inviteToTrip(tripId, email.trim(), role);
      
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
          color: '#6200ea'
        };
      case 'editor':
        return {
          title: 'Editor',
          description: 'Can edit trip details but cannot manage participants',
          color: '#03a9f4'
        };
      case 'viewer':
        return {
          title: 'Viewer',
          description: 'Can view trip details only',
          color: '#9e9e9e'
        };
      default:
        return {
          title: 'Unknown',
          description: '',
          color: '#9e9e9e'
        };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="Invite Participants" subtitle={tripName} />
      </Appbar.Header>

      <ScrollView style={styles.scrollView}>
        <View style={styles.formContainer}>
          <Text style={styles.sectionTitle}>Add participants to your trip</Text>
          <Text style={styles.sectionDescription}>
            Invite friends by email and set their access role
          </Text>

          <TextInput
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.roleTitle}>Select Role:</Text>
          
          <RadioButton.Group onValueChange={value => setRole(value)} value={role}>
            {['admin', 'editor', 'viewer'].map((roleValue) => {
              const roleInfo = getRoleDisplayInfo(roleValue);
              return (
                <Card key={roleValue} style={[styles.roleCard, role === roleValue && styles.selectedRoleCard]}>
                  <Card.Content style={styles.roleCardContent}>
                    <View style={styles.roleLeftContent}>
                      <RadioButton value={roleValue} />
                      <View style={styles.roleTextContainer}>
                        <Text style={styles.roleTextTitle}>{roleInfo.title}</Text>
                        <Text style={styles.roleTextDescription}>{roleInfo.description}</Text>
                      </View>
                    </View>
                    <Avatar.Icon 
                      size={36} 
                      icon={roleValue === 'admin' ? 'account-key' : roleValue === 'editor' ? 'account-edit' : 'account-eye'} 
                      style={{ backgroundColor: roleInfo.color }}
                    />
                  </Card.Content>
                </Card>
              );
            })}
          </RadioButton.Group>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Button 
            mode="contained" 
            onPress={handleInvite}
            style={styles.button}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : 'Send Invitation'}
          </Button>
          
          <View style={styles.buttonContainer}>
            <Button 
              mode="outlined" 
              onPress={handleViewTrip}
              style={styles.secondaryButton}
            >
              View Trip
            </Button>
            
            <Button 
              mode="outlined" 
              onPress={handleFinish}
              style={styles.secondaryButton}
            >
              Finish
            </Button>
          </View>
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
  scrollView: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  input: {
    marginBottom: 24,
    backgroundColor: '#fff',
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  roleCard: {
    marginBottom: 12,
    elevation: 1,
  },
  selectedRoleCard: {
    borderColor: '#6200ea',
    borderWidth: 1,
  },
  roleCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleLeftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  roleTextContainer: {
    marginLeft: 8,
  },
  roleTextTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  roleTextDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  errorText: {
    color: 'red',
    marginTop: 8,
    marginBottom: 16,
  },
  button: {
    marginTop: 24,
    paddingVertical: 8,
    backgroundColor: '#6200ea',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  secondaryButton: {
    flex: 0.48,
  },
});

export default InviteParticipantsScreen;