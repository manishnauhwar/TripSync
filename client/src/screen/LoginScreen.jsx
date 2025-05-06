import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Card, Button } from 'react-native-paper';
import React, { useState, useEffect } from 'react';
import api from '../apis/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBiometrics from 'react-native-biometrics';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const LoginScreen = ({ navigation }) => {
    const [usernameOrEmail, setUsernameOrEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isBiometricsAvailable, setIsBiometricsAvailable] = useState(false);

    useEffect(() => {
        checkBiometricAvailability();
        checkSavedCredentials();
    }, []);

    const checkBiometricAvailability = async () => {
        const rnBiometrics = new ReactNativeBiometrics();
        const { available, biometryType } = await rnBiometrics.isSensorAvailable();
        setIsBiometricsAvailable(available && biometryType === 'Fingerprint');
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
                
                Alert.alert('Success', 'Login successful!');
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

    const handleBiometricLogin = async () => {
        try {
            const rnBiometrics = new ReactNativeBiometrics();
            const { available } = await rnBiometrics.isSensorAvailable();
            
            if (!available) {
                Alert.alert('Error', 'Fingerprint sensor is not available on this device');
                return;
            }
            const savedUsername = await AsyncStorage.getItem('savedUsername');
            if (!savedUsername) {
                Alert.alert('Notice', 'Please login with username and password first to enable fingerprint login');
                return;
            }

            setLoading(true);

            const { success } = await rnBiometrics.simplePrompt({ 
                promptMessage: 'Authenticate with fingerprint' 
            });

            if (success) {
                const token = await AsyncStorage.getItem('token');
                const userDetails = await AsyncStorage.getItem('userDetails');
                
                if (token && userDetails) {
                    setUsernameOrEmail(savedUsername);
                    Alert.alert('Success', 'Biometric authentication successful!');
                } else {
                    Alert.alert('Session Expired', 'Please login with your credentials again');
                }
            } else {
                setError('Biometric authentication failed');
            }
        } catch (error) {
            console.log('Biometric login error:', error);
            setError('Biometric authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Card style={styles.card}>
                <Card.Content style={styles.cardContent}>
                    <View style={styles.form}>
                        <Text style={styles.heading}>Login</Text>
                        {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    </View>
                    <View>
                        <TextInput
                            placeholder="Username or Email"
                            placeholderTextColor="#999"
                            value={usernameOrEmail}
                            onChangeText={setUsernameOrEmail}
                            style={styles.input}
                        />
                        <TextInput
                            placeholder="Password"
                            placeholderTextColor="#999"
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                            style={styles.input}
                        />
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
                        
                        {isBiometricsAvailable && (
                            <TouchableOpacity 
                                style={styles.biometricButton} 
                                onPress={handleBiometricLogin}
                                disabled={loading}
                            >
                                <Icon name="fingerprint" size={28} color="#6200ea" />
                                <Text style={styles.biometricText}>Login with Fingerprint</Text>
                            </TouchableOpacity>
                        )}
                        
                        <Button
                            mode="text"
                            onPress={() => navigation.navigate('Register')}
                            style={styles.linkButton}
                            labelStyle={styles.linkButtonLabel}
                        >
                            Don't have an account? Register
                        </Button>
                    </View>
                </Card.Content>
            </Card>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        marginHorizontal: 10,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    cardContent: {
        padding: 20,
    },
    form: {
        alignItems: 'center',
        marginBottom: 20,
    },
    heading: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
    },
    errorText: {
        color: '#d32f2f',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 10,
    },
    input: {
        marginBottom: 15,
        backgroundColor: '#fff',
        fontSize: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        color: '#333',
    },
    button: {
        marginTop: 20,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#6200ea',
    },
    buttonLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    biometricButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 15,
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#f0e7ff',
    },
    biometricText: {
        marginLeft: 10,
        fontSize: 14,
        fontWeight: '500',
        color: '#6200ea',
    },
    linkButton: {
        marginTop: 15,
    },
    linkButtonLabel: {
        fontSize: 14,
        color: '#6200ea',
    }
});

export default LoginScreen;