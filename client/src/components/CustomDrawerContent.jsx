import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../apis/api';
import SyncIndicator from './SyncIndicator';

const CustomDrawerContent = (props) => {
  const [username, setUsername] = useState('');

  useEffect(() => {
    getUserData();
  }, []);

  const getUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('userDetails');
      if (userData) {
        const parsedData = JSON.parse(userData);
        setUsername(parsedData.username || 'User');
      }
    } catch (error) {
      console.log('Error getting user data', error);
    }
  };

  const handleLogout = useCallback(async () => {
    try {
      await api.logout().catch(err => console.log('API logout error:', err));
      
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('userDetails');
      
    } catch (error) {
      console.log('Logout error:', error);
    }
  }, []);

  return (
    <DrawerContentScrollView {...props}>
      <View style={styles.drawerHeader}>
        <Text style={styles.username}>Hello, {username}</Text>
      </View>
      <DrawerItemList {...props} />
      
      <View style={styles.syncContainer}>
        <SyncIndicator />
      </View>
      
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </DrawerContentScrollView>
  );
};

const styles = StyleSheet.create({
  drawerHeader: {
    padding: 20,
    backgroundColor: '#f0f0f0',
    marginBottom: 10,
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  syncContainer: {
    marginTop: 10,
    marginHorizontal: 5,
  },
  logoutButton: {
    marginTop: 20,
    backgroundColor: '#ff4757',
    padding: 15,
    marginHorizontal: 20,
    borderRadius: 5,
  },
  logoutText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
});

export default CustomDrawerContent;