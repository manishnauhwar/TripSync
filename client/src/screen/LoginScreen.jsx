import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, ImageBackground, StatusBar, useColorScheme } from 'react-native';
import { Card, Button } from 'react-native-paper';
import React, { useState, useEffect } from 'react';
import api from '../apis/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DeviceInfo from 'react-native-device-info';
import notificationService from '../services/NotificationService';
import permissionService from '../services/PermissionService';
import { Platform } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithCredential,
    signOut as firebaseSignOut
} from '@react-native-firebase/auth';
import { navigationRef } from '../apis/navigationRef';
import { LinearGradient } from 'react-native-linear-gradient';

const LoginScreen = ({ navigation }) => {
    const [usernameOrEmail, setUsernameOrEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [googleConfigured, setGoogleConfigured] = useState(false);
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
    };

    useEffect(() => {
        checkSavedCredentials();
        setupGoogleSignIn();
    }, []);

    const setupGoogleSignIn = async () => {
        try {
            GoogleSignin.configure({
                webClientId: '279406075787-mlvgmdqfoe75sbsv0eoj62o9umg67h3i.apps.googleusercontent.com',
                offlineAccess: true,
                forceCodeForRefreshToken: true,
            });
            
            const isPlayServicesAvailable = await GoogleSignin.hasPlayServices({ 
                showPlayServicesUpdateDialog: true 
            });
            setGoogleConfigured(isPlayServicesAvailable);
        } catch (error) {
            console.error('Google Sign-In configuration error:', error);
            setGoogleConfigured(false);
        }
    };

    const checkSavedCredentials = async () => {
        try {
            const savedUsername = await AsyncStorage.getItem('savedUsername');
            if (savedUsername) {
                setUsernameOrEmail(savedUsername);
            }
        } catch (error) {
            console.log('Error retrieving saved credentials:', error);
        }
    };

    const validateInputs = () => {
        if (!usernameOrEmail || !password) {
            setError('All fields are required');
            return false;
        }
        return true;
    };

    const handleLogin = async () => {
        if (!validateInputs()) {
            return;
        }
        setLoading(true);
        try {
            const formattedUsernameOrEmail = usernameOrEmail.toLowerCase().trim();
            const response = await api.login(formattedUsernameOrEmail, password);
            
            if (response.success) {
                const userData = response.data.user;
                await AsyncStorage.setItem('userDetails', JSON.stringify(userData));
                await AsyncStorage.setItem('token', response.data.token);
                await AsyncStorage.setItem('savedUsername', formattedUsernameOrEmail);
                
                // Request storage permissions
                await permissionService.requestStoragePermission();
                
                // Initialize notifications
                await registerFCMToken();
                
                // Force app to re-render by triggering a state change
                await AsyncStorage.setItem('forceUpdate', Date.now().toString());
            } else {
                setError(response.error || 'Invalid credentials');
            }
        } catch (error) {
            console.log('Login error:', error);
            setError('An error occurred during login. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const registerFCMToken = async () => {
        try {
            const fcmToken = await AsyncStorage.getItem('fcmToken');
            const deviceId = await AsyncStorage.getItem('deviceId') || await DeviceInfo.getUniqueId();
            
            if (fcmToken) {
                await api.registerDevice(deviceId, fcmToken, Platform.OS);
                console.log('FCM token registered after login');
            } else {
                await notificationService.initialize();
            }
        } catch (error) {
            console.error('Error registering FCM token after login:', error);
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            setGoogleLoading(true);
            setError('');

            // First, sign out from any previous sessions
            try {
                await GoogleSignin.signOut();
            } catch (signOutError) {
                console.log('Google Sign-Out error (non-critical):', signOutError);
            }

            // Check if Google Play Services are available
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

            // Get Google Sign-In response
            const response = await GoogleSignin.signIn();
            const userInfo = response.data || response;
            
            if (!userInfo || !userInfo.idToken) {
                throw new Error('Failed to get ID token from Google');
            }

            // Create Google credential
            const googleCredential = GoogleAuthProvider.credential(userInfo.idToken);

            // Get Firebase auth instance
            const auth = getAuth();

            // Sign in with Firebase
            const userCredential = await signInWithCredential(auth, googleCredential);
            const firebaseUser = userCredential.user;

            // Prepare user data for backend
            const userData = {
                email: firebaseUser.email,
                name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
                googleId: firebaseUser.uid,
                photo: firebaseUser.photoURL || ''
            };

            // Send to backend
            const backendResponse = await api.googleLogin(userData);

            if (backendResponse.success) {
                await AsyncStorage.setItem('userDetails', JSON.stringify(backendResponse.data.user));
                await AsyncStorage.setItem('token', backendResponse.data.token);
                await AsyncStorage.setItem('savedUsername', firebaseUser.email);
                
                // Request storage permissions
                await permissionService.requestStoragePermission();
                
                // Initialize notifications
                await registerFCMToken();
                
                // Force app to re-render by triggering a state change
                await AsyncStorage.setItem('forceUpdate', Date.now().toString());
            } else {
                throw new Error(backendResponse.error || 'Google login failed');
            }
        } catch (error) {
            console.log('Google Sign-In error:', error);
            
            if (error.code === statusCodes.SIGN_IN_CANCELLED) {
                setError('Sign in was cancelled');
            } else if (error.code === statusCodes.IN_PROGRESS) {
                setError('Sign in is already in progress');
            } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
                setError('Google Play services are not available or outdated');
            } else {
                setError(error.message || 'An error occurred during Google sign-in');
            }
        } finally {
            setGoogleLoading(false);
        }
    };

    return (
        <ImageBackground
            source={require('../assets/images/7.jpeg')}
            style={styles.backgroundImage}
        >
            <StatusBar
                barStyle={isDarkMode ? 'light-content' : 'dark-content'}
                backgroundColor="transparent"
                translucent
            />
            <View style={styles.container}>
                <Card style={[styles.card, { backgroundColor: theme.background }]}>
                    <Card.Content style={styles.cardContent}>
                        <View style={styles.form}>
                            <Text style={[styles.heading, { color: theme.text }]}>Welcome Back!</Text>
                            {error ? <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text> : null}
                        </View>
                        <View>
                            <TextInput
                                placeholder="Username or Email"
                                placeholderTextColor={theme.subtext}
                                value={usernameOrEmail}
                                onChangeText={setUsernameOrEmail}
                                style={[styles.input, { 
                                    backgroundColor: theme.cardBackground,
                                    color: theme.text,
                                    borderColor: theme.divider
                                }]}
                            />
                            <TextInput
                                placeholder="Password"
                                placeholderTextColor={theme.subtext}
                                secureTextEntry
                                value={password}
                                onChangeText={setPassword}
                                style={[styles.input, { 
                                    backgroundColor: theme.cardBackground,
                                    color: theme.text,
                                    borderColor: theme.divider
                                }]}
                            />
                            <LinearGradient
                                colors={['#6200ea', '#03DAC6']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.gradientButton}
                            >
                                <Button
                                    mode="contained"
                                    onPress={handleLogin}
                                    style={styles.button}
                                    loading={loading}
                                    disabled={loading}
                                    labelStyle={styles.buttonLabel}
                                >
                                    LOGIN
                                </Button>
                            </LinearGradient>
                            
                            <TouchableOpacity 
                                style={[styles.googleButton, (loading || googleLoading) && styles.disabledButton]} 
                                onPress={handleGoogleSignIn}
                                disabled={loading || googleLoading}
                            >
                                {googleLoading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Icon name="google" size={24} color="#fff" />
                                        <Text style={styles.googleButtonText}>Sign in with Google</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            
                            <Button
                                mode="text"
                                onPress={() => navigation.navigate('Register')}
                                style={styles.linkButton}
                                labelStyle={[styles.linkButtonLabel, { color: theme.primary }]}
                            >
                                Don't have an account? Register
                            </Button>
                        </View>
                    </Card.Content>
                </Card>
            </View>
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
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    card: {
        borderRadius: 24,
        marginHorizontal: 10,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardContent: {
        padding: 24,
    },
    form: {
        alignItems: 'center',
        marginBottom: 24,
    },
    heading: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 16,
        fontFamily: 'Roboto',
    },
    errorText: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 16,
        fontFamily: 'Roboto',
    },
    input: {
        marginBottom: 16,
        fontSize: 16,
        padding: 16,
        borderWidth: 1,
        borderRadius: 12,
        fontFamily: 'Roboto',
    },
    gradientButton: {
        borderRadius: 12,
        marginTop: 8,
        marginBottom: 16,
    },
    button: {
        backgroundColor: 'transparent',
        paddingVertical: 8,
        borderRadius: 12,
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        fontFamily: 'Roboto',
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4285F4',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    googleButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 12,
        fontFamily: 'Roboto',
    },
    disabledButton: {
        opacity: 0.7,
    },
    linkButton: {
        marginTop: 8,
    },
    linkButtonLabel: {
        fontSize: 14,
        fontFamily: 'Roboto',
    }
});

export default LoginScreen;