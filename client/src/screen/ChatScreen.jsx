import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform, Image, Alert,
  ImageBackground, StatusBar, Dimensions, useColorScheme, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, IconButton, Menu, Divider } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import api from '../apis/api';
import socketService from '../apis/socketService';
import { endpoint as API_URL } from '../config';
import axios from 'axios';
import { LinearGradient } from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width, height } = Dimensions.get('window');

const ChatScreen = ({ route, navigation }) => {
  const { tripId, tripName } = route.params;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [showAttachOptions, setShowAttachOptions] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [deletingMessage, setDeletingMessage] = useState(false);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [loadingImages, setLoadingImages] = useState({});
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [location, setLocation] = useState(null);
  
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const theme = {
    background: isDarkMode ? 'rgba(18, 18, 18, 0.8)' : 'rgba(255, 255, 255, 0.8)',
    text: isDarkMode ? '#FFFFFF' : '#333333',
    cardBackground: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    subtext: isDarkMode ? '#AAAAAA' : '#666666',
    primary: '#2E7D32', 
    accent: '#03DAC6',
    error: '#CF6679',
    divider: isDarkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
  };

  useFocusEffect(
    useCallback(() => {
      const init = async () => {
        setLoading(true);
        try {
          await socketService.connect();
          socketService.joinTrip(tripId);
          socketService.on('new-message', handleNewMessage);
          socketService.on('user-typing', handleUserTyping);
          socketService.on('user-stop-typing', handleUserStopTyping);
          socketService.on('user-online', (userId) => setOnlineUsers((prev) => [...new Set([...prev, userId])]));
          socketService.on('user-offline', (userId) => setOnlineUsers((prev) => prev.filter((id) => id !== userId)));
          socketService.on('message-deleted', handleMessageDeleted);

          const userData = await AsyncStorage.getItem('userDetails');
          const user = userData ? JSON.parse(userData) : null;
          setCurrentUser(user);

          const [messagesRes, tripRes] = await Promise.all([
            api.getMessages(tripId),
            api.getTripById(tripId),
          ]);

          if (messagesRes.success) {
            const formattedMessages = messagesRes.data.data
              .filter(msg => !msg.deleted) 
              .map((msg) => ({
                ...msg,
                sender: { ...msg.sender, _id: msg.sender._id || msg.sender.id },
              }));
            const initialLoadingState = {};
            formattedMessages.forEach(msg => {
              if (msg.type === 'image' && msg.mediaUrl) {
                initialLoadingState[msg._id] = true;
              }
            });
            setLoadingImages(initialLoadingState);
            
            setMessages(formattedMessages);
            setIsFirstLoad(true);
            
            if (user) {
              const unread = formattedMessages
                .filter((msg) => !msg.readBy.includes(user._id))
                .map((msg) => msg._id);
              if (unread.length) await api.markMessagesAsRead(tripId, unread);
            }
          }

          if (tripRes.success) {
            setParticipants(tripRes.data.data.participants.filter((p) => p.status === 'accepted'));
          }
        } catch (error) {
          console.error('Init error:', error);
        } finally {
          setLoading(false);
        }
      };

      init();
      return () => {
        socketService.off('new-message');
        socketService.off('user-typing');
        socketService.off('user-stop-typing');
        socketService.off('user-online');
        socketService.off('user-offline');
        socketService.off('message-deleted');
        setLoadingImages({});
      };
    }, [tripId])
  );

  useEffect(() => {
    if (route.params?.location) {
      const loadUserAndShareLocation = async () => {
        try {
          if (!currentUser) {
            const userData = await AsyncStorage.getItem('userDetails');
            if (userData) {
              const user = JSON.parse(userData);
              setCurrentUser(user);
              handleLocationShare(route.params.location, user);
            } else {
              Alert.alert('Error', 'User data not found. Please try again.');
            }
          } else {
            handleLocationShare(route.params.location, currentUser);
          }
        } catch (error) {
          console.error('Error loading user data:', error);
          Alert.alert('Error', 'Failed to load user data. Please try again.');
        }
        // Clear the location from route params
        navigation.setParams({ location: undefined });
      };

      loadUserAndShareLocation();
    }
  }, [route.params?.location]);

  const handleNewMessage = (message) => {
    console.log('New message received:', message);
    if (!message._id || message.deleted) return;
    setMessages(prevMessages => {
      if (prevMessages.some(msg => msg._id === message._id)) {
        return prevMessages;
      }
      
      const formattedMessage = {
        ...message,
        sender: {
          ...message.sender,
          _id: message.sender._id || message.sender.id
        }
      };
      
      if (formattedMessage.type === 'image' && formattedMessage.mediaUrl) {
        setImageLoading(formattedMessage._id, true);
      }
      
      const updatedMessages = [...prevMessages, formattedMessage];
      
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
      
      if (currentUser && message.sender._id !== currentUser._id) {
        api.markMessagesAsRead(tripId, [message._id]);
      }
      
      return updatedMessages;
    });
  };

  const handleMessageDeleted = (data) => {
    const { messageId, deleteForEveryone } = data;
    
    if (deleteForEveryone) {
      setMessages(prevMessages => 
        prevMessages.filter(msg => msg._id !== messageId)
      );
      return;
    }
    
    const userId = currentUser ? currentUser._id || currentUser.id : null;
    const message = messages.find(msg => msg._id === messageId);
    
    if (!message) return;
    
    const senderId = message.sender._id || message.sender.id;
    
    if (userId && senderId && String(userId) === String(senderId)) {
      setMessages(prevMessages => 
        prevMessages.filter(msg => msg._id !== messageId)
      );
    }
  };

  const handleUserTyping = (userId) => {
    if (currentUser && userId !== currentUser._id) {
      setTypingUsers((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
    }
  };

  const handleUserStopTyping = (userId) => {
    setTypingUsers((prev) => prev.filter((id) => id !== userId));
  };

  const handleLongPressMessage = (message) => {
    if (!message || message._id.toString().startsWith('temp-')) return;
    
    const userId = currentUser ? currentUser._id || currentUser.id : null;
    const senderId = message.sender._id || message.sender.id;
    const isCurrentUserMessage = userId && senderId && String(userId) === String(senderId);
    const hasMedia = message.type === 'image' && message.mediaUrl;
    
    setSelectedMessage(message);
    
    // Show different options based on whether it's the user's message
    if (isCurrentUserMessage) {
      // For the user's own messages, show both delete options
      const deleteForEveryoneWarning = hasMedia 
        ? "This will also delete the image from storage. This action cannot be undone." 
        : "";
        
      Alert.alert(
        "Delete Message",
        `How would you like to delete this message?${deleteForEveryoneWarning ? "\n\n" + deleteForEveryoneWarning : ""}`,
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          { 
            text: "Delete for me", 
            onPress: () => deleteMessage(message._id, false)
          },
          { 
            text: "Delete for everyone", 
            onPress: () => deleteMessage(message._id, true),
            style: "destructive" 
          }
        ]
      );
    } else {
      // For messages from others, only show "Delete for me" option
      Alert.alert(
        "Delete Message",
        "Do you want to delete this message?",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          { 
            text: "Delete for me", 
            onPress: () => deleteMessage(message._id, false) 
          }
        ]
      );
    }
  };

  const deleteMessage = async (messageId, forEveryone = false) => {
    try {
      setDeletingMessage(true);
      
      // Find the message to determine if it has media
      const messageToDelete = messages.find(msg => msg._id === messageId);
      const hasMedia = messageToDelete && messageToDelete.type === 'image' && messageToDelete.mediaUrl;
      
      // If this is an image and is being deleted for everyone, show an appropriate message
      if (hasMedia && forEveryone) {
        Alert.alert('Deleting', 'Deleting message and associated media...');
      }
      
      const response = await api.deleteMessage(tripId, messageId, forEveryone);
      
      if (response.success) {
        // Remove message from local state
        setMessages(prevMessages => 
          prevMessages.filter(msg => msg._id !== messageId)
        );
        
        // If deleting for everyone, notify other participants
        if (forEveryone) {
          socketService.deleteMessage(tripId, messageId, true);
        }
        
        console.log(`Message ${messageId} deleted ${forEveryone ? 'for everyone' : 'for me'}`);
      } else {
        Alert.alert('Error', response.error || 'Failed to delete message');
      }
    } catch (error) {
      console.error('Delete message error:', error);
      Alert.alert('Error', 'Failed to delete message');
    } finally {
      setDeletingMessage(false);
      setSelectedMessage(null);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      clearTimeout(typingTimeoutRef.current);
      setIsTyping(false);
      socketService.sendStopTyping(tripId);

      const content = newMessage.trim();
      setNewMessage('');
      const tempId = `temp-${Date.now()}`;
      const tempMessage = {
        _id: tempId,
        content,
        type: 'text',
        sender: currentUser,
        createdAt: new Date(),
        readBy: [currentUser._id]
      };
      setMessages(prev => [...prev, tempMessage]);
      
      if (flatListRef.current) {
        setTimeout(() => flatListRef.current.scrollToEnd({ animated: true }), 100);
      }
      const response = await api.sendMessage(tripId, content);
      
      if (response.success) {
        const serverMessage = response.data.data;
        setMessages(prev => prev.map(msg => 
          msg._id === tempId ? {
            ...serverMessage,
            sender: { ...serverMessage.sender, _id: serverMessage.sender._id || serverMessage.sender.id }
          } : msg
        ));
        socketService.sendMessage(tripId, content, 'text', null, null, serverMessage);
      } else {
        setMessages(prev => prev.map(msg => 
          msg._id === tempId ? { ...msg, failed: true } : msg
        ));
      }
    } catch (error) {
      console.error('Send message error:', error);
    }
  };

  const handleTyping = (text) => {
    setNewMessage(text);
    if (!isTyping && text.trim()) {
      setIsTyping(true);
      socketService.sendTyping(tripId);
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketService.sendStopTyping(tripId);
    }, 3000);
  };

  const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formatDate = (date) => new Date(date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  const getInitials = (user) => {
    if (!user) return '?';
    const name = user.fullName || user.email || '';
    const names = name.split(' ');
    return names.length > 1 ? `${names[0][0]}${names[1][0]}`.toUpperCase() : name[0]?.toUpperCase() || '?';
  };

  const getUserName = (user) => user?.fullName || user?.email || 'Unknown';

  const renderParticipant = ({ item }) => (
    <TouchableOpacity style={styles.participant}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitials({ email: item.email })}</Text>
        {onlineUsers.includes(item.user._id) && <View style={styles.online} />}
      </View>
      <Text style={styles.participantName}>{item.email}</Text>
    </TouchableOpacity>
  );

  const fixImageUrl = (url) => {
    if (!url) return null;
    
    console.log('Original image URL:', url);
    
    // Handle Cloudinary URLs (they're already properly formatted)
    if (url.includes('cloudinary.com')) {
      return url;
    }
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    if (url.startsWith('/')) {
      return `${API_URL}${url}`;
    }
    
    if (url.includes('/api/chat/uploads/')) {
      const fileName = url.split('/api/chat/uploads/').pop();
      return `${API_URL}/uploads/${fileName}`;
    }
    
    return url;
  };

  const setImageLoading = (messageId, isLoading) => {
    setLoadingImages(prev => ({
      ...prev,
      [messageId]: isLoading
    }));
  };

  const handleMedia = async () => {
    try {
      const options = { mediaType: 'photo', quality: 0.8 };
      const result = await launchImageLibrary(options);

      if (result.didCancel || !result.assets?.length) {
        return;
      }

      const { uri, fileName = 'image.jpg', type: mimeType } = result.assets[0];
      const tempId = `temp-${Date.now()}`;
      const tempMessage = {
        _id: tempId,
        content: 'Shared an image',
        type: 'image',
        mediaUrl: uri, 
        sender: currentUser,
        createdAt: new Date(),
        readBy: [currentUser._id],
        uploading: true
      };
      setImageLoading(tempId, true);
      setMessages(prev => [...prev, tempMessage]);
      setShowAttachOptions(false);
      
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
      
      const fileData = {
        uri,
        type: mimeType || 'image/jpeg',
        name: fileName
      };
      
      const apiUrl = API_URL || 'http://10.0.2.2:3000';
      let signatureData;
      try {
        const response = await axios.get(`${apiUrl}/api/cloudinary/signature`);
        signatureData = response.data;
      } catch (err) {
        try {
          const response = await axios.get(`${apiUrl}/get-signature`);
          signatureData = response.data;
        } catch (sigError) {
          throw new Error('Failed to get upload signature from server');
        }
      }
      
      if (!signatureData || !signatureData.signature) {
        throw new Error('Failed to get valid signature from server');
      }
      
      const { signature, timestamp } = signatureData;
      const formData = new FormData();
      const file = {
        uri: Platform.OS === 'android' ? fileData.uri : fileData.uri.replace('file://', ''),
        type: fileData.type || 'image/jpeg',
        name: fileData.name || 'image.jpg'
      };
      
      formData.append('file', file);
      formData.append('api_key', '275526128117363'); 
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      
      let cloudinaryResponse;
      let retries = 0;
      const maxRetries = 2;
      
      while (retries <= maxRetries) {
        try {
          const response = await fetch('https://api.cloudinary.com/v1_1/dgkvgk1ij/auto/upload', {
            method: 'POST',
            body: formData,
            headers: { 'Accept': 'application/json' }
          });
          
          if (!response.ok) {
            throw new Error(`Upload failed: ${await response.text()}`);
          }
          
          const responseData = await response.json();
          if (responseData.secure_url) {
            cloudinaryResponse = {
              success: true,
              url: responseData.secure_url,
              publicId: responseData.public_id,
              fileType: responseData.format || fileData.type,
            };
            break;
          } else {
            throw new Error('No secure_url in response');
          }
        } catch (uploadErr) {
          if (retries === maxRetries) {
            throw uploadErr;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          retries++;
        }
      }
      
      if (!cloudinaryResponse || !cloudinaryResponse.url) {
        throw new Error('Failed to upload image to cloud storage');
      }
      
      const mediaUrl = cloudinaryResponse.url;
      const msgRes = await api.sendMessage(tripId, 'Shared an image', 'image', mediaUrl);
      
      if (msgRes.success) {
        const serverMessage = msgRes.data.data;
        const serverId = serverMessage._id;
        setImageLoading(tempId, false);
        setImageLoading(serverId, true);
        
        setMessages(prev => prev.map(msg => 
          msg._id === tempId ? {
            ...serverMessage,
            sender: { ...serverMessage.sender, _id: serverMessage.sender._id || serverMessage.sender.id }
          } : msg
        ));
        socketService.sendMessage(tripId, 'Shared an image', 'image', mediaUrl, null, serverMessage);
        
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }, 100);
      } else {
        setImageLoading(tempId, false);
        setMessages(prev => prev.map(msg => 
          msg._id === tempId ? { ...msg, failed: true, uploading: false } : msg
        ));
      }
    } catch (error) {
      console.error('Media error:', error);
      Alert.alert('Error', 'Failed to upload image: ' + (error.message || 'Unknown error'));
      setMessages(prev => prev.filter(msg => !msg._id.toString().startsWith('temp-')));
    }
  };

  const handleLocationShare = async (locationData, user) => {
    try {
      if (!user) {
        console.error('User not found');
        Alert.alert('Error', 'Unable to share location. Please try again.');
        return;
      }

      if (!tripId) {
        console.error('Trip ID not found');
        Alert.alert('Error', 'Trip information not found. Please try again.');
        return;
      }

      const tempId = `temp-${Date.now()}`;
      const tempMessage = {
        _id: tempId,
        content: 'Shared a location',
        type: 'location',
        location: locationData,
        sender: user,
        createdAt: new Date(),
        readBy: [user._id]
      };

      setMessages(prev => [...prev, tempMessage]);
      setShowAttachOptions(false);

      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);

      const msgRes = await api.sendMessage(tripId, 'Shared a location', 'location', null, locationData);

      if (msgRes.success) {
        const serverMessage = msgRes.data.data;
        setMessages(prev => prev.map(msg => 
          msg._id === tempId ? {
            ...serverMessage,
            sender: { ...serverMessage.sender, _id: serverMessage.sender._id || serverMessage.sender.id }
          } : msg
        ));
        socketService.sendMessage(tripId, 'Shared a location', 'location', null, locationData, serverMessage);
      } else {
        setMessages(prev => prev.map(msg => 
          msg._id === tempId ? { ...msg, failed: true } : msg
        ));
        Alert.alert('Error', 'Failed to share location. Please try again.');
      }
    } catch (error) {
      console.error('Location share error:', error);
      Alert.alert('Error', 'Failed to share location. Please try again.');
      setMessages(prev => prev.filter(msg => !msg._id.toString().startsWith('temp-')));
    }
  };

  const handleLocationPress = (location) => {
    const { latitude, longitude } = location;
    const url = Platform.select({
      ios: `maps:${latitude},${longitude}?q=${latitude},${longitude}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}`
    });

    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Could not open maps application');
      }
    });
  };

  const renderMessage = ({ item, index }) => {
    const userId = currentUser ? currentUser._id || currentUser.id : null;
    const senderId = item.sender._id || item.sender.id;
    const isCurrentUser = userId && senderId && String(userId) === String(senderId);
    const showDate = index === 0 || new Date(item.createdAt).toDateString() !== new Date(messages[index - 1].createdAt).toDateString();
    const isTemp = item._id.toString().startsWith('temp-');
    const isFailed = item.failed === true;
    const isImageLoading = loadingImages[item._id] === true;

    return (
      <>
        {showDate && (
          <View style={styles.dateHeader}>
            <Text style={[styles.dateText, { color: theme.text, backgroundColor: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)' }]}>
              {formatDate(item.createdAt)}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.message, isCurrentUser ? styles.rightMsg : styles.leftMsg]}
          onLongPress={() => handleLongPressMessage(item)}
          delayLongPress={500}
          activeOpacity={0.7}
        >
          {!isCurrentUser && <Text style={[styles.sender, { color: isDarkMode ? '#fff' : '#333' }]}>
            {getUserName(item.sender)}
          </Text>}
          <View style={[
            styles.content, 
            isCurrentUser 
              ? { backgroundColor: 'rgba(46, 125, 50, 0.9)' }
              : { backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)' },
            isTemp && styles.tempMessage,
            isFailed && styles.failedMessage
          ]}>
            {item.type === 'text' && (
              <Text style={[
                styles.text,
                { color: isCurrentUser ? '#fff' : theme.text }
              ]}>
                {item.content}
              </Text>
            )}
            
            {item.type === 'image' && (
              <TouchableOpacity 
                onPress={() => {
                  if (item.mediaUrl && !isTemp) {
                    const fixedUrl = fixImageUrl(item.mediaUrl);
                    console.log('Opening image viewer with URL:', fixedUrl);
                    navigation.navigate('ImageViewer', { uri: fixedUrl });
                  }
                }}
                disabled={isTemp && item.uploading}
              >
                <View style={styles.imageContainer}>
                  {item.mediaUrl ? (
                    <Image
                      source={{ uri: fixImageUrl(item.mediaUrl) }}
                      style={styles.image}
                      resizeMode="cover"
                      onLoadStart={() => {
                        console.log('Image loading started:', fixImageUrl(item.mediaUrl));
                        setImageLoading(item._id, true);
                      }}
                      onLoad={() => {
                        console.log('Image loaded successfully:', fixImageUrl(item.mediaUrl));
                        setImageLoading(item._id, false);
                      }}
                      onError={(e) => {
                        console.error('Image error:', e.nativeEvent.error, 'URL:', fixImageUrl(item.mediaUrl));
                        setImageLoading(item._id, false);
                        if (!isTemp) {
                          const fixedUrl = fixImageUrl(item.mediaUrl);
                          if (fixedUrl.includes('cloudinary.com')) {
                            console.log('Retrying Cloudinary image with cache-busting:', `${fixedUrl}?t=${Date.now()}`);
                            setMessages(prev => prev.map(msg => 
                              msg._id === item._id 
                                ? {...msg, mediaUrl: `${fixedUrl}?t=${Date.now()}`} 
                                : msg
                            ));
                          } else {
                            console.log('Retrying with fixed URL:', `${fixedUrl}?t=${Date.now()}`);
                            setMessages(prev => prev.map(msg => 
                              msg._id === item._id 
                                ? {...msg, mediaUrl: `${fixedUrl}?t=${Date.now()}`} 
                                : msg
                            ));
                          }
                        }
                      }}
                      defaultSource={require('../assets/images/placeholder.png')}
                    />
                  ) : (
                    <Image
                      source={require('../assets/images/placeholder.png')}
                      style={[styles.image, { opacity: 0.5 }]}
                      resizeMode="center"
                    />
                  )}
                  {((item.uploading || isImageLoading) && !isFailed) && (
                    <ActivityIndicator 
                      style={styles.imageLoader} 
                      size="large" 
                      color={theme.primary} 
                    />
                  )}
                  {isFailed && (
                    <View style={styles.errorOverlay}>
                      <Text style={styles.errorText}>Failed</Text>
                      <TouchableOpacity 
                        style={[styles.retryButton, { backgroundColor: theme.primary }]}
                        onPress={() => handleMedia()}
                      >
                        <Text style={styles.retryText}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}

            {item.type === 'location' && (
              <TouchableOpacity 
                onPress={() => handleLocationPress(item.location)}
                style={styles.locationContainer}
              >
                <View style={styles.locationContent}>
                  <Icon name="map-marker" size={24} color={isCurrentUser ? '#fff' : theme.primary} />
                  <Text style={[
                    styles.locationText,
                    { color: isCurrentUser ? '#fff' : theme.text }
                  ]}>
                    View Location
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            
            <View style={styles.messageFooter}>
              <Text style={[
                styles.time, 
                { color: isCurrentUser ? 'rgba(255,255,255,0.7)' : theme.subtext }
              ]}>
                {formatTime(item.createdAt)}
              </Text>
              {isTemp && !isFailed && (
                <Text style={[
                  styles.statusText, 
                  { color: isCurrentUser ? 'rgba(255,255,255,0.6)' : theme.subtext }
                ]}>
                  Sending...
                </Text>
              )}
              {isFailed && (
                <Text style={styles.failedText}>Failed</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </>
    );
  };

  const renderTyping = () => {
    if (!typingUsers.length) return null;
    const names = typingUsers.map((id) => getUserName(participants.find((p) => p.user === id)) || 'Someone');
    const text = names.length === 1 ? `${names[0]} is typing...` : 'Multiple users are typing...';
    return (
      <View style={styles.typing}>
        <Text style={[styles.typingText, { color: theme.text }]}>{text}</Text>
      </View>
    );
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setTimeout(() => {
        if (flatListRef.current && messages.length > 0) {
          flatListRef.current.scrollToEnd({ animated: false });
        }
      }, 100);
    });

    return unsubscribe;
  }, [navigation, messages.length]);

  useEffect(() => {
    const messageIds = new Set(messages.map(msg => msg._id));
    const outdatedLoadingIds = Object.keys(loadingImages).filter(id => !messageIds.has(id));
    if (outdatedLoadingIds.length > 0) {
      console.log('Cleaning up outdated loading states for:', outdatedLoadingIds);
      const newLoadingImages = { ...loadingImages };
      outdatedLoadingIds.forEach(id => {
        delete newLoadingImages[id];
      });
      setLoadingImages(newLoadingImages);
    }
  }, [messages, loadingImages]);

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
        <Appbar.Header style={styles.appbar}>
          <Appbar.BackAction color="#fff" onPress={() => navigation.goBack()} />
          <Appbar.Content title={`${tripName} Chat`} titleStyle={styles.appbarTitle} />
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={<Appbar.Action icon="account-group" color="#fff" onPress={() => setMenuVisible(true)} />}
          >
            <Menu.Item title="Participants" disabled />
            <Divider />
            <FlatList
              data={participants}
              renderItem={renderParticipant}
              keyExtractor={(item) => item._id}
              style={styles.participantList}
            />
          </Menu>
        </Appbar.Header>

        {loading ? (
          <View style={[styles.loading, { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.8)' }]}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : null}
            style={styles.chat}
            keyboardVerticalOffset={90}
          >
            <LinearGradient
              colors={[isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0.8)']}
              style={styles.messagesContainer}
            >
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.messages}
                onContentSizeChange={() => {
                  if (!isFirstLoad && flatListRef.current) {
                    flatListRef.current.scrollToEnd({ animated: false });
                  }
                }}
                onLayout={() => {
                  if (isFirstLoad && messages.length > 0 && flatListRef.current) {
                    setTimeout(() => {
                      flatListRef.current.scrollToEnd({ animated: false });
                      setIsFirstLoad(false);
                    }, 100);
                  }
                }}
                maintainVisibleContentPosition={{
                  minIndexForVisible: 0,
                  autoscrollToTopThreshold: 10
                }}
                initialNumToRender={20}
                maxToRenderPerBatch={10}
                windowSize={21}
                removeClippedSubviews={false}
              />
              {renderTyping()}
            </LinearGradient>
            <View style={[styles.inputArea, { 
              backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)' 
            }]}>
              <TouchableOpacity onPress={() => setShowAttachOptions(!showAttachOptions)}>
                <IconButton icon="paperclip" size={24} color={theme.primary} />
              </TouchableOpacity>
              <TextInput
                style={[styles.input, { 
                  color: theme.text,
                  backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' 
                }]}
                placeholder="Type a message..."
                value={newMessage}
                onChangeText={handleTyping}
                multiline
                placeholderTextColor={isDarkMode ? '#999' : '#666'}
              />
              <TouchableOpacity onPress={sendMessage} disabled={!newMessage.trim()}>
                <IconButton icon="send" size={24} color={newMessage.trim() ? theme.primary : '#ccc'} />
              </TouchableOpacity>
            </View>
            {showAttachOptions && (
              <View style={[styles.attach, { 
                backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)' 
              }]}>
                <TouchableOpacity style={styles.option} onPress={handleMedia}>
                  <IconButton 
                    icon="image" 
                    size={24} 
                    color="#fff" 
                    style={[styles.optionIcon, { backgroundColor: theme.primary }]} 
                  />
                  <Text style={[styles.optionText, { color: theme.subtext }]}>Image</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.option} 
                  onPress={() => {
                    setShowAttachOptions(false);
                    navigation.navigate('LocationViewer', {
                      tripId: tripId,
                      tripName: tripName
                    });
                  }}
                >
                  <IconButton 
                    icon="map-marker" 
                    size={24} 
                    color="#fff" 
                    style={[styles.optionIcon, { backgroundColor: theme.primary }]} 
                  />
                  <Text style={[styles.optionText, { color: theme.subtext }]}>Location</Text>
                </TouchableOpacity>
              </View>
            )}
          </KeyboardAvoidingView>
        )}
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
  loading: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  appbar: {
    backgroundColor: 'transparent',
    elevation: 0,
  },
  appbarTitle: {
    color: '#fff',
    fontWeight: 'bold',
  },
  chat: { 
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  messagesContainer: {
    flex: 1,
    borderRadius: 20,
    margin: 10,
  },
  messages: { 
    padding: 16,
    paddingBottom: 24,
  },
  dateHeader: { 
    alignItems: 'center', 
    marginVertical: 1 
  },
  dateText: { 
    fontSize: 12, 
    padding: 6, 
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  message: { 
    maxWidth: '80%', 
    marginVertical: 6 
  },
  leftMsg: { 
    alignSelf: 'flex-start' 
  },
  rightMsg: { 
    alignSelf: 'flex-end' 
  },
  sender: { 
    fontSize: 12, 
    marginLeft: 8, 
    marginBottom: 2,
    fontWeight: 'bold', 
  },
  content: { 
    padding: 12, 
    borderRadius: 18, 
    elevation: 2 
  },
  text: { 
    fontSize: 16,
  },
  image: { 
    width: 220, 
    height: 200, 
    borderRadius: 12 
  },
  time: { 
    fontSize: 10, 
    alignSelf: 'flex-end', 
    marginTop: 4 
  },
  inputArea: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 8, 
    borderTopWidth: 1, 
    borderColor: 'rgba(0,0,0,0.1)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginHorizontal: 10,
  },
  input: { 
    flex: 1, 
    borderRadius: 20, 
    padding: 10, 
    maxHeight: 100,
  },
  typing: { 
    padding: 8,
    marginBottom: 8,
  },
  typingText: { 
    fontSize: 12, 
    fontStyle: 'italic',
    textAlign: 'center',
  },
  participantList: { 
    padding: 8, 
    maxHeight: 300 
  },
  participant: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8 
  },
  avatar: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: '#2E7D32', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12 
  },
  avatarText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  participantName: { 
    fontSize: 14 
  },
  online: { 
    position: 'absolute', 
    width: 10, 
    height: 10, 
    borderRadius: 5, 
    backgroundColor: '#4CAF50', 
    bottom: 0, 
    right: 0 
  },
  attach: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    padding: 16,
    marginHorizontal: 10,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderTopWidth: 1, 
    borderColor: 'rgba(0,0,0,0.1)' 
  },
  option: { 
    alignItems: 'center' 
  },
  optionIcon: { 
    borderRadius: 20 
  },
  optionText: { 
    fontSize: 12, 
    marginTop: 4 
  },
  errorText: { 
    color: '#fff', 
    textAlign: 'center', 
    fontSize: 14,
    fontWeight: 'bold',
  },
  imageContainer: { 
    position: 'relative', 
    width: 200, 
    height: 200, 
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  imageLoader: { 
    position: 'absolute',
    zIndex: 1
  },
  tempMessage: {
    opacity: 0.7,
  },
  failedMessage: {
    borderColor: '#f44336',
    borderWidth: 1,
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  failedText: {
    fontSize: 10,
    color: '#f44336',
    fontWeight: 'bold',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 12,
  },
  retryText: {
    color: 'white',
    fontWeight: 'bold',
  },
  locationContainer: {
    marginVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  locationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  locationText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
});

export default ChatScreen;