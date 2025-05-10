import { View, Text, TextInput, StyleSheet, Alert, ImageBackground, StatusBar, useColorScheme } from 'react-native';
import { Card, Button } from 'react-native-paper';
import React, { useState } from 'react';
import api from '../apis/api';
import { LinearGradient } from 'react-native-linear-gradient';

const RegisterScreen = ({ navigation }) => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
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

    const validateInputs = () => {
        if (!username || !email || !password || !confirmPassword || !fullName) {
            setError('All fields are required');
            return false;
        }

        const trimmedFullName = fullName.trim();
        if (!/^[a-zA-Z]+(?: [a-zA-Z]+)*$/.test(trimmedFullName)) {
            setError('Full name must contain only alphabets and single spaces between words');
            return false;
        }
        if (trimmedFullName.length < 3) {
            setError('Full name must be at least 3 characters long');
            return false;
        }
        if (trimmedFullName.split(' ').some(word => word.length < 1)) {
            setError('Full name cannot have multiple spaces between words');
            return false;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return false;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('Invalid email format');
            return false;
        }
        return true;
    };

    const handleRegister = async () => {
        if (!validateInputs()) {
            return;
        }
        setLoading(true);
        try {
            const formattedUsername = username.toLowerCase().trim();
            const formattedEmail = email.toLowerCase().trim();
            const formattedFullName = fullName.trim().replace(/\s+/g, ' ');

            const response = await api.register(
                formattedUsername,
                formattedEmail,
                password,
                formattedFullName,
                confirmPassword
            );
            if (response.success) {
                Alert.alert('Success', 'Registration successful!');
                navigation.replace('Login');
            } else {
                setError(response.error || 'Registration failed. Please try again.');
            }
        } catch (error) {
            setError('An error occurred during registration. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ImageBackground
            source={require('../assets/images/5.jpeg')}
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
                            <Text style={[styles.heading, { color: theme.text }]}>Create Account</Text>
                            {error ? <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text> : null}
                        </View>
                        <View>
                            <TextInput
                                placeholder="Full Name"
                                placeholderTextColor={theme.subtext}
                                value={fullName}
                                onChangeText={setFullName}
                                style={[styles.input, { 
                                    backgroundColor: theme.cardBackground,
                                    color: theme.text,
                                    borderColor: theme.divider
                                }]}
                            />
                            <TextInput
                                placeholder="Username"
                                placeholderTextColor={theme.subtext}
                                value={username}
                                onChangeText={setUsername}
                                style={[styles.input, { 
                                    backgroundColor: theme.cardBackground,
                                    color: theme.text,
                                    borderColor: theme.divider
                                }]}
                            />
                            <TextInput
                                placeholder="Email"
                                placeholderTextColor={theme.subtext}
                                value={email}
                                onChangeText={setEmail}
                                style={[styles.input, { 
                                    backgroundColor: theme.cardBackground,
                                    color: theme.text,
                                    borderColor: theme.divider
                                }]}
                                keyboardType="email-address"
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
                            <TextInput
                                placeholder="Confirm Password"
                                placeholderTextColor={theme.subtext}
                                secureTextEntry
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
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
                                    onPress={handleRegister}
                                    style={styles.button}
                                    loading={loading}
                                    disabled={loading}
                                    labelStyle={styles.buttonLabel}
                                >
                                    GET STARTED
                                </Button>
                            </LinearGradient>
                            <Button
                                mode="text"
                                onPress={() => navigation.replace('Login')}
                                style={styles.linkButton}
                                labelStyle={[styles.linkButtonLabel, { color: theme.primary }]}
                            >
                                Already have an account? Login
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
    linkButton: {
        marginTop: 8,
    },
    linkButtonLabel: {
        fontSize: 14,
        fontFamily: 'Roboto',
    }
});

export default RegisterScreen;