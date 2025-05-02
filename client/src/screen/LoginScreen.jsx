import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { Card, Button } from 'react-native-paper';
import React, { useState, useEffect } from 'react';
import api from '../apis/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LoginScreen = ({ navigation }) => {
    const [usernameOrEmail, setUsernameOrEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);


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
    linkButton: {
        marginTop: 15,
    },
    linkButtonLabel: {
        fontSize: 14,
        color: '#6200ea',
    }
});

export default LoginScreen;