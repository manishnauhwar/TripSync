import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator,
  TextInput, KeyboardAvoidingView, Platform, Image, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, IconButton, Menu, Divider } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import Geolocation from 'react-native-geolocation-service';
import { PERMISSIONS, request } from 'react-native-permissions';
import api from '../apis/api';
import socketService from '../apis/socketService';

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
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [loadingImages, setLoadingImages] = useState({});  
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

          const userData = await AsyncStorage.getItem('userDetails');
          const user = userData ? JSON.parse(userData) : null;
          setCurrentUser(user);

          const [messagesRes, tripRes] = await Promise.all([
            api.getMessages(tripId),
            api.getTripById(tripId),
          ]);

          if (messagesRes.success) {
            const formattedMessages = messagesRes.data.data.map((msg) => ({
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
        setLoadingImages({});
      };
    }, [tripId])
  );

  const handleNewMessage = (message) => {
    console.log('New message received:', message);
    if (!message._id) return;
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

  const handleUserTyping = (userId) => {
    if (currentUser && userId !== currentUser._id) {
      setTypingUsers((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
    }
  };

  const handleUserStopTyping = (userId) => {
    setTypingUsers((prev) => prev.filter((id) => id !== userId));
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
        socketService.sendMessage(tripId, content);
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
    if (url.includes('/api/chat/uploads/')) {
      const fileName = url.split('/api/chat/uploads/').pop();
      const baseUrl = url.split('/api/chat/uploads/')[0];
      return `${baseUrl}/uploads/${fileName}`;
    }
    return url;
  };
  const setImageLoading = (messageId, isLoading) => {
    setLoadingImages(prev => ({
      ...prev,
      [messageId]: isLoading
    }));
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
            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          </View>
        )}
        <View style={[styles.message, isCurrentUser ? styles.rightMsg : styles.leftMsg]}>
          {!isCurrentUser && <Text style={styles.sender}>{getUserName(item.sender)}</Text>}
          <View style={[
            styles.content, 
            isCurrentUser ? styles.sent : styles.received,
            isTemp && styles.tempMessage,
            isFailed && styles.failedMessage
          ]}>
            {item.type === 'text' && <Text style={styles.text}>{item.content}</Text>}
            
            {item.type === 'image' && (
              <TouchableOpacity 
                onPress={() => {
                  if (item.mediaUrl && !isTemp) {
                    const fixedUrl = fixImageUrl(item.mediaUrl);
                    navigation.navigate('ImageViewer', { uri: fixedUrl });
                  }
                }}
                disabled={isTemp && item.uploading}
              >
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: item.mediaUrl ? fixImageUrl(item.mediaUrl) : null }}
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
                        setMessages(prev => prev.map(msg => 
                          msg._id === item._id 
                            ? {...msg, mediaUrl: `${fixedUrl}?t=${Date.now()}`} 
                            : msg
                        ));
                      }
                    }}
                    defaultSource={require('../assets/placeholder.png')}
                  />
                  {((item.uploading || isImageLoading) && !isFailed) && (
                    <ActivityIndicator 
                      style={styles.imageLoader} 
                      size="large" 
                      color="#6200ee" 
                    />
                  )}
                  {isFailed && (
                    <View style={styles.errorOverlay}>
                      <Text style={styles.errorText}>Failed</Text>
                      <TouchableOpacity 
                        style={styles.retryButton}
                        onPress={() => handleMedia('image')}
                      >
                        <Text style={styles.retryText}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}
            
            {item.type === 'document' && item.mediaUrl && (
              <TouchableOpacity style={styles.doc} onPress={() => Linking.openURL(item.mediaUrl)}>
                <IconButton icon="file-document" size={24} color="#fff" />
                <Text style={styles.docText}>{item.content}</Text>
              </TouchableOpacity>
            )}
            
            {item.type === 'location' && item.location && (
              <TouchableOpacity
                style={styles.loc}
                onPress={() => {
                  const { latitude, longitude } = item.location;
                  if (
                    !isNaN(latitude) &&
                    !isNaN(longitude) &&
                    latitude >= -90 &&
                    latitude <= 90 &&
                    longitude >= -180 &&
                    longitude <= 180
                  ) {
                    navigation.navigate('LocationViewer', {
                      latitude,
                      longitude,
                      title: `Location from ${getUserName(item.sender)}`,
                    });
                  } else {
                    console.error('Invalid location:', item.location);
                    alert('Invalid location data.');
                  }
                }}
              >
                <IconButton icon="map-marker" size={24} color="#fff" />
                <Text style={styles.locText}>Location shared</Text>
              </TouchableOpacity>
            )}
            
            <View style={styles.messageFooter}>
              <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
              {isTemp && !isFailed && (
                <Text style={styles.statusText}>Sending...</Text>
              )}
              {isFailed && (
                <Text style={styles.failedText}>Failed</Text>
              )}
            </View>
          </View>
        </View>
      </>
    );
  };
  const renderTyping = () => {
    if (!typingUsers.length) return null;
    const names = typingUsers.map((id) => getUserName(participants.find((p) => p.user === id)) || 'Someone');
    const text = names.length === 1 ? `${names[0]} is typing...` : 'Multiple users are typing...';
    return (
      <View style={styles.typing}>
        <Text style={styles.typingText}>{text}</Text>
      </View>
    );
  };
  const requestLocationPermission = async () => {
    try {
      const result = await request(
        Platform.OS === 'ios' ? PERMISSIONS.IOS.LOCATION_WHEN_IN_USE : PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
      );
      return result === 'granted';
    } catch (error) {
      console.error('Permission error:', error);
      return false;
    }
  };
  const handleLocationSharing = async () => {
    try {
      setLoading(true);
      const granted = await requestLocationPermission();
      if (!granted) {
        alert('Location permission denied.');
        return;
      }

      const position = await new Promise((resolve, reject) => {
        Geolocation.getCurrentPosition(
          resolve,
          reject,
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
        );
      });

      const { latitude, longitude } = position.coords;
      if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new Error('Invalid coordinates');
      }

      const response = await api.sendMessage(tripId, 'Shared a location', 'location', null, { latitude, longitude });
      if (response.success) {
        socketService.sendMessage(tripId, 'Shared a location', 'location', null, { latitude, longitude });
      }
      setShowAttachOptions(false);
    } catch (error) {
      console.error('Location error:', error);
      alert(`Failed to share location: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  const handleMedia = async (type) => {
    try {
      setLoading(true);
      const options = { mediaType: type === 'image' ? 'photo' : 'mixed', quality: 0.8 };
      const result = await launchImageLibrary(options);

      if (result.didCancel || !result.assets?.length) {
        setLoading(false);
        return;
      }

      const { uri, fileName = `${type}.jpg`, type: mimeType } = result.assets[0];
      const tempId = `temp-${Date.now()}`;
      const tempMessage = {
        _id: tempId,
        content: type === 'image' ? 'Shared an image' : `Shared: ${fileName}`,
        type,
        mediaUrl: uri, 
        sender: currentUser,
        createdAt: new Date(),
        readBy: [currentUser._id],
        uploading: true
      };
      setImageLoading(tempId, true);
      setMessages(prev => [...prev, tempMessage]);
      setShowAttachOptions(false);
      if (flatListRef.current) {
        setTimeout(() => flatListRef.current.scrollToEnd({ animated: true }), 100);
      }
      const formData = new FormData();
      formData.append('file', { uri, type: mimeType || 'application/octet-stream', name: fileName });

      const uploadRes = await api.uploadMedia(formData);
      
      if (uploadRes.success && uploadRes.data.fileUrl) {
        let mediaUrl = uploadRes.data.fileUrl;
        if (mediaUrl.includes('/api/chat/uploads/')) {
          const fileName = mediaUrl.split('/api/chat/uploads/').pop();
          const baseUrl = mediaUrl.split('/api/chat/uploads/')[0];
          mediaUrl = `${baseUrl}/uploads/${fileName}`;
          console.log('Modified media URL to use public path:', mediaUrl);
        }
        
        const content = type === 'image' ? 'Shared an image' : `Shared: ${fileName}`;
        
        const msgRes = await api.sendMessage(tripId, content, type, mediaUrl);
        
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
          socketService.sendMessage(tripId, content, type, mediaUrl);
        } else {
          setImageLoading(tempId, false);
          setMessages(prev => prev.map(msg => 
            msg._id === tempId ? { ...msg, failed: true, uploading: false } : msg
          ));
        }
      } else {
        setImageLoading(tempId, false);
        setMessages(prev => prev.map(msg => 
          msg._id === tempId ? { ...msg, failed: true, uploading: false } : msg
        ));
        alert('Failed to upload media.');
      }
    } catch (error) {
      console.error('Media error:', error);
      alert('Failed to upload media.');
    } finally {
      setLoading(false);
    }
  };
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
    <SafeAreaView style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={`${tripName} Chat`} />
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={<Appbar.Action icon="account-group" onPress={() => setMenuVisible(true)} />}
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
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#6200ee" />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : null}
          style={styles.chat}
          keyboardVerticalOffset={90}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.messages}
            onContentSizeChange={() => flatListRef.current.scrollToEnd({ animated: false })}
            initialNumToRender={20}
          />
          {renderTyping()}
          <View style={styles.inputArea}>
            <TouchableOpacity onPress={() => setShowAttachOptions(!showAttachOptions)}>
              <IconButton icon="paperclip" size={24} color="#6200ee" />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              value={newMessage}
              onChangeText={handleTyping}
              multiline
            />
            <TouchableOpacity onPress={sendMessage} disabled={!newMessage.trim()}>
              <IconButton icon="send" size={24} color={newMessage.trim() ? '#6200ee' : '#ccc'} />
            </TouchableOpacity>
          </View>
          {showAttachOptions && (
            <View style={styles.attach}>
              <TouchableOpacity style={styles.option} onPress={() => handleMedia('image')}>
                <IconButton icon="image" size={24} color="#fff" style={styles.optionIcon} />
                <Text style={styles.optionText}>Image</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.option} onPress={() => handleMedia('document')}>
                <IconButton icon="file-document" size={24} color="#fff" style={[styles.optionIcon, { backgroundColor: '#2196F3' }]} />
                <Text style={styles.optionText}>Document</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.option} onPress={handleLocationSharing}>
                <IconButton icon="map-marker" size={24} color="#fff" style={[styles.optionIcon, { backgroundColor: '#F44336' }]} />
                <Text style={styles.optionText}>Location</Text>
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chat: { flex: 1 },
  messages: { padding: 8 },
  dateHeader: { alignItems: 'center', marginVertical: 8 },
  dateText: { fontSize: 12, color: '#666', backgroundColor: '#e0e0e0', padding: 4, borderRadius: 8 },
  message: { maxWidth: '80%', marginVertical: 4 },
  leftMsg: { alignSelf: 'flex-start' },
  rightMsg: { alignSelf: 'flex-end' },
  sender: { fontSize: 12, color: '#666', marginLeft: 8, marginBottom: 2 },
  content: { padding: 8, borderRadius: 12, elevation: 1 },
  sent: { backgroundColor: '#e1f5fe' },
  received: { backgroundColor: '#fff' },
  text: { fontSize: 16 },
  image: { width: 200, height: 200, borderRadius: 8 },
  doc: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2196F3', borderRadius: 8, padding: 4 },
  docText: { color: '#fff', fontSize: 14 },
  loc: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F44336', borderRadius: 8, padding: 4 },
  locText: { color: '#fff', fontSize: 14 },
  time: { fontSize: 10, color: '#666', alignSelf: 'flex-end', marginTop: 4 },
  inputArea: { flexDirection: 'row', alignItems: 'center', padding: 8, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee' },
  input: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, padding: 8, maxHeight: 100 },
  typing: { padding: 8 },
  typingText: { fontSize: 12, color: '#666', fontStyle: 'italic' },
  participantList: { padding: 8, maxHeight: 300 },
  participant: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#6200ee', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  participantName: { fontSize: 14 },
  online: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#4CAF50', bottom: 0, right: 0 },
  attach: { flexDirection: 'row', justifyContent: 'space-around', padding: 8, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#eee' },
  option: { alignItems: 'center' },
  optionIcon: { backgroundColor: '#4CAF50', borderRadius: 20 },
  optionText: { fontSize: 12, color: '#666' },
  errorText: { color: '#f00', textAlign: 'center', fontSize: 14 },
  imageContainer: { 
    position: 'relative', 
    width: 200, 
    height: 200, 
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
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
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
    color: '#666',
    fontStyle: 'italic',
  },
  failedText: {
    fontSize: 10,
    color: '#f44336',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#6200ee',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 8,
  },
  retryText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default ChatScreen;