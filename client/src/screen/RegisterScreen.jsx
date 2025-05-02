import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { Card, Button } from 'react-native-paper';
import React, { useState } from 'react';
import api from '../apis/api';

const RegisterScreen = ({ navigation }) => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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
        <View style={styles.container}>
            <Card style={styles.card}>
                <Card.Content style={styles.cardContent}>
                    <View style={styles.form}>
                        <Text style={styles.heading}>Create Account</Text>
                        {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    </View>
                    <View>
                        <TextInput
                            placeholder="Full Name"
                            placeholderTextColor="#999"
                            value={fullName}
                            onChangeText={setFullName}
                            style={styles.input}
                        />
                        <TextInput
                            placeholder="Username"
                            placeholderTextColor="#999"
                            value={username}
                            onChangeText={setUsername}
                            style={styles.input}
                        />
                        <TextInput
                            placeholder="Email"
                            placeholderTextColor="#999"
                            value={email}
                            onChangeText={setEmail}
                            style={styles.input}
                            keyboardType="email-address"
                        />
                        <TextInput
                            placeholder="Password"
                            placeholderTextColor="#999"
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                            style={styles.input}
                        />
                        <TextInput
                            placeholder="Confirm Password"
                            placeholderTextColor="#999"
                            secureTextEntry
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            style={styles.input}
                        />
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
                        <Button
                            mode="text"
                            onPress={() => navigation.replace('Login')}
                            style={styles.linkButton}
                            labelStyle={styles.linkButtonLabel}
                        >
                            Already have an account? Login
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

export default RegisterScreen;