import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableWithoutFeedback,
  Animated
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Appbar, IconButton, Badge, Menu, Divider } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const flatListRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      const connectAndFetch = async () => {
        setLoading(true);
        try {
          await socketService.connect();
          socketService.joinTrip(tripId);
          
          setupSocketListeners();
          
          await fetchMessages();
          await fetchTripDetails();
        } catch (error) {
          console.error('Error connecting to chat:', error);
        } finally {
          setLoading(false);
        }
      };
      
      connectAndFetch();
      
      return () => {
        removeSocketListeners();
      };
    }, [tripId])
  );

  const setupSocketListeners = () => {
    socketService.on('new-message', handleNewMessage);
    
    socketService.on('user-online', handleUserOnline);
    socketService.on('user-offline', handleUserOffline);
    
    socketService.on('user-typing', handleUserTyping);
    socketService.on('user-stop-typing', handleUserStopTyping);
  };

  const removeSocketListeners = () => {
    socketService.off('new-message');
    socketService.off('user-online');
    socketService.off('user-offline');
    socketService.off('user-typing');
    socketService.off('user-stop-typing');
  };

  const fetchMessages = async () => {
    try {
      const response = await api.getMessages(tripId);
      
      if (response.success) {
        setMessages(response.data.data);
        
        const userData = await AsyncStorage.getItem('userDetails');
        if (userData) {
          const user = JSON.parse(userData);
          setCurrentUser(user);
          
          const unreadMessages = response.data.data
            .filter(msg => !msg.readBy.includes(user._id))
            .map(msg => msg._id);
            
          if (unreadMessages.length > 0) {
            await api.markMessagesAsRead(tripId, unreadMessages);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchTripDetails = async () => {
    try {
      const response = await api.getTripById(tripId);
      
      if (response.success) {
        const acceptedParticipants = response.data.data.participants
          .filter(p => p.status === 'accepted');
        
        setParticipants(acceptedParticipants);
      }
    } catch (error) {
      console.error('Error fetching trip details:', error);
    }
  };

  const handleNewMessage = (message) => {
    setMessages(prevMessages => [...prevMessages, message]);
    
    if (currentUser && message.sender._id === currentUser._id) {
      api.markMessagesAsRead(tripId, [message._id]);
    }
    
    if (flatListRef.current) {
      setTimeout(() => {
        flatListRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleUserOnline = (userId) => {
    setOnlineUsers(prev => [...prev, userId]);
  };

  const handleUserOffline = (userId) => {
    setOnlineUsers(prev => prev.filter(id => id !== userId));
  };

  const handleUserTyping = (userId) => {
    if (currentUser && userId !== currentUser._id) {
      setTypingUsers(prev => {
        if (!prev.includes(userId)) {
          return [...prev, userId];
        }
        return prev;
      });
    }
  };

  const handleUserStopTyping = (userId) => {
    setTypingUsers(prev => prev.filter(id => id !== userId));
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    try {
      setIsTyping(false);
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      socketService.sendStopTyping(tripId);
      
      await api.sendMessage(tripId, newMessage.trim());
      
      setNewMessage('');
      
      socketService.sendMessage(tripId, newMessage.trim());
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleTyping = (text) => {
    setNewMessage(text);
    if (!isTyping) {
      setIsTyping(true);
      socketService.sendTyping(tripId);
    }
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    const timeout = setTimeout(() => {
      setIsTyping(false);
      socketService.sendStopTyping(tripId);
    }, 3000);
    
    setTypingTimeout(timeout);
  };

  const formatTime = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return '';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return '';
    }
  };

  const getInitials = (user) => {
    if (!user) return '?';
    
    if (user.fullName) {
      const names = user.fullName.split(' ');
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
      } else if (names.length === 1) {
        return names[0][0].toUpperCase();
      }
    }
    
    return user.username ? user.username[0].toUpperCase() : '?';
  };

  const getUserNameDisplay = (user) => {
    if (!user) return 'Unknown User';
    return user.fullName || user.username || user.email || 'Unknown User';
  };

  const isUserOnline = (userId) => {
    return onlineUsers.includes(userId);
  };

  const renderParticipantItem = ({ item }) => {
    const isOnline = item.user && isUserOnline(item.user._id);
    
    return (
      <TouchableOpacity style={styles.participantItem}>
        <View style={styles.participantAvatar}>
          <Text style={styles.avatarText}>{getInitials({ fullName: item.email })}</Text>
          {isOnline && <View style={styles.onlineIndicator} />}
        </View>
        <Text style={styles.participantName}>{item.email}</Text>
      </TouchableOpacity>
    );
  };

  const renderMessageItem = ({ item, index }) => {
    const isCurrentUser = currentUser && item.sender._id === currentUser._id;
    const showDateHeader = index === 0 || 
      new Date(item.createdAt).toDateString() !== new Date(messages[index - 1].createdAt).toDateString();

    return (
      <>
        {showDateHeader && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderText}>{formatDate(item.createdAt)}</Text>
          </View>
        )}
        <View style={[
          styles.messageContainer,
          isCurrentUser ? styles.rightMessage : styles.leftMessage
        ]}>
          {!isCurrentUser && (
            <View style={styles.messageSender}>
              <Text style={styles.messageSenderText}>
                {getUserNameDisplay(item.sender)}
              </Text>
            </View>
          )}
          
          <View style={styles.messageContent}>
            {item.type === 'text' && (
              <Text style={styles.messageText}>{item.content}</Text>
            )}
            
            {item.type === 'image' && (
              <Image 
                source={{ uri: item.mediaUrl }} 
                style={styles.messageImage} 
                resizeMode="cover"
              />
            )}
            
            {item.type === 'location' && (
              <View style={styles.locationContainer}>
                <IconButton 
                  icon="map-marker" 
                  size={20} 
                  color="#fff"
                />
                <Text style={styles.locationText}>Location shared</Text>
              </View>
            )}
            
            <Text style={styles.messageTime}>{formatTime(item.createdAt)}</Text>
          </View>
        </View>
      </>
    );
  };

  const renderTypingIndicator = () => {
    if (typingUsers.length === 0) return null;
    
    const typingNames = typingUsers.map(userId => {
      const participant = participants.find(p => p.user === userId);
      return participant ? getUserNameDisplay(participant) : 'Someone';
    });
    
    let typingText = '';
    if (typingNames.length === 1) {
      typingText = `${typingNames[0]} is typing...`;
    } else if (typingNames.length === 2) {
      typingText = `${typingNames[0]} and ${typingNames[1]} are typing...`;
    } else {
      typingText = 'Several people are typing...';
    }
    
    return (
      <View style={styles.typingContainer}>
        <Text style={styles.typingText}>{typingText}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={`${tripName} Chat`} />
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Appbar.Action 
              icon="account-group" 
              onPress={() => setMenuVisible(true)}
            />
          }
        >
          <Menu.Item title="Online Participants" disabled />
          <Divider />
          <View style={styles.participantsList}>
            <FlatList
              data={participants}
              renderItem={renderParticipantItem}
              keyExtractor={(item) => item._id}
              style={{ maxHeight: 300 }}
            />
          </View>
        </Menu>
      </Appbar.Header>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : null}
          style={styles.chatContainer}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessageItem}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.messagesList}
              onContentSizeChange={() => flatListRef.current.scrollToEnd({ animated: false })}
              onLayout={() => flatListRef.current.scrollToEnd({ animated: false })}
            />
          </TouchableWithoutFeedback>
          
          {renderTypingIndicator()}
          
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              value={newMessage}
              onChangeText={handleTyping}
              multiline
            />
            <TouchableOpacity 
              style={styles.sendButton} 
              onPress={sendMessage}
              disabled={!newMessage.trim()}
            >
              <IconButton
                icon="send"
                size={24}
                color={newMessage.trim() ? '#6200ee' : '#ccc'}
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  chatContainer: {
    flex: 1
  },
  messagesList: {
    padding: 10,
    paddingBottom: 20
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: 10
  },
  dateHeaderText: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    color: '#333',
    fontSize: 12,
    padding: 5,
    borderRadius: 10
  },
  messageContainer: {
    maxWidth: '80%',
    marginVertical: 5
  },
  leftMessage: {
    alignSelf: 'flex-start',
  },
  rightMessage: {
    alignSelf: 'flex-end',
  },
  messageSender: {
    marginLeft: 10,
    marginBottom: 2
  },
  messageSenderText: {
    fontSize: 12,
    color: '#666'
  },
  messageContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    elevation: 1
  },
  messageText: {
    fontSize: 16
  },
  messageTime: {
    fontSize: 10,
    color: '#999',
    alignSelf: 'flex-end',
    marginTop: 4
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee'
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100
  },
  sendButton: {
    marginLeft: 5
  },
  typingContainer: {
    paddingHorizontal: 15,
    paddingVertical: 5
  },
  typingText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic'
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 10
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6200ee',
    borderRadius: 10,
    padding: 5
  },
  locationText: {
    color: '#fff',
    marginLeft: 5
  },
  participantsList: {
    padding: 10
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8
  },
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6200ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    position: 'relative'
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  participantName: {
    fontSize: 14
  },
  onlineIndicator: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
    bottom: 0,
    right: 0
  }
});

export default ChatScreen; 