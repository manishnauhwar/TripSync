import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '../models';
import { Q } from '@nozbe/watermelondb';
import api from '../apis/api';

class OfflineService {
  constructor() {
    this.isOnline = false;
    this.isSyncing = false;
    this.syncSubscribers = [];
    this.unsubscribeNetInfo = null;
    this.databaseReady = false;
  }

  async initialize() {
    try {
      // Ensure database is initialized
      if (!database) {
        throw new Error('Database not initialized');
      }
      this.databaseReady = true;

      // Set up network state listener
      this.unsubscribeNetInfo = NetInfo.addEventListener(state => {
        const wasOnline = this.isOnline;
        this.isOnline = state.isConnected && state.isInternetReachable;
        
        // Notify subscribers of connection state change
        this.notifySubscribers(this.isOnline ? 'online' : 'offline');
        
        // If we just came online and database is ready, try to sync
        if (!wasOnline && this.isOnline && this.databaseReady) {
          this.syncWithServer();
        }
      });

      // Check initial network state
      const state = await NetInfo.fetch();
      this.isOnline = state.isConnected && state.isInternetReachable;
      
      // Sync if we're online and database is ready
      if (this.isOnline && this.databaseReady) {
        this.syncWithServer();
      }
    } catch (error) {
      console.error('Error initializing OfflineService:', error);
      this.databaseReady = false;
      throw error;
    }
  }

  async cleanup() {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
    }
  }

  subscribe(callback) {
    this.syncSubscribers.push(callback);
    return () => {
      this.syncSubscribers = this.syncSubscribers.filter(cb => cb !== callback);
    };
  }

  notifySubscribers(status, progress = null) {
    this.syncSubscribers.forEach(cb => {
      try {
        cb(status, progress);
      } catch (error) {
        console.error('Error in sync subscriber callback:', error);
      }
    });
  }

  async syncWithServer() {
    if (this.isSyncing || !this.isOnline) return;
    
    this.isSyncing = true;
    this.notifySubscribers('started');
    
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Track sync progress
      let progress = 0;
      const totalSteps = 6; // Number of sync operations

      // Sync trips
      await this.syncTrips();
      progress++;
      this.notifySubscribers('progress', { current: progress, total: totalSteps, type: 'trips' });
      
      // Sync participants
      await this.syncParticipants();
      progress++;
      this.notifySubscribers('progress', { current: progress, total: totalSteps, type: 'participants' });
      
      // Sync itinerary items
      await this.syncItineraryItems();
      progress++;
      this.notifySubscribers('progress', { current: progress, total: totalSteps, type: 'itinerary' });
      
      // Sync messages
      await this.syncMessages();
      progress++;
      this.notifySubscribers('progress', { current: progress, total: totalSteps, type: 'messages' });
      
      // Sync expenses and splits
      await this.syncExpenses();
      progress++;
      this.notifySubscribers('progress', { current: progress, total: totalSteps, type: 'expenses' });
      
      // Sync documents
      await this.syncDocuments();
      progress++;
      this.notifySubscribers('progress', { current: progress, total: totalSteps, type: 'documents' });

      this.notifySubscribers('completed');
    } catch (error) {
      console.error('Sync error:', error);
      this.notifySubscribers('failed', {
        message: error.message,
        type: error.type || 'unknown',
        retryable: error.retryable !== false
      });
    } finally {
      this.isSyncing = false;
    }
  }

  async syncTrips() {
    // Push local changes
    const unsyncedTrips = await database.get('trips')
      .query(Q.where('is_synced', false))
      .fetch();

    for (const trip of unsyncedTrips) {
      try {
        const tripData = trip.prepareForSync();
        const response = await api.createTrip(tripData);
        if (response.success) {
          await trip.markAsSynced(response.data._id);
        }
      } catch (error) {
        console.error('Error syncing trip:', error);
      }
    }

    // Pull server changes
    try {
      const response = await api.getTrips();
      if (response.success) {
        await database.write(async () => {
          for (const tripData of response.data) {
            const existingTrip = await database.get('trips')
              .query(Q.where('server_id', tripData._id))
              .fetch();

            if (existingTrip.length === 0) {
              await database.get('trips').create(trip => {
                trip.name = tripData.name;
                trip.description = tripData.description;
                trip.creatorId = tripData.creator;
                trip.startDate = tripData.startDate ? new Date(tripData.startDate) : null;
                trip.endDate = tripData.endDate ? new Date(tripData.endDate) : null;
                trip.serverId = tripData._id;
                trip.isSynced = true;
              });
            }
          }
        });
      }
    } catch (error) {
      console.error('Error pulling trips:', error);
    }
  }

  async syncParticipants() {
    // Push local changes
    const unsyncedParticipants = await database.get('participants')
      .query(Q.where('is_synced', false))
      .fetch();

    for (const participant of unsyncedParticipants) {
      try {
        const participantData = participant.prepareForSync();
        const response = await api.addParticipant(participant.tripId, participantData);
        if (response.success) {
          await participant.markAsSynced(response.data._id);
        }
      } catch (error) {
        console.error('Error syncing participant:', error);
      }
    }

    // Pull server changes
    try {
      const trips = await database.get('trips').fetch();
      for (const trip of trips) {
        const response = await api.getParticipants(trip.serverId);
        if (response.success) {
          await database.write(async () => {
            for (const participantData of response.data) {
              const existingParticipant = await database.get('participants')
                .query(Q.where('server_id', participantData._id))
                .fetch();

              if (existingParticipant.length === 0) {
                await database.get('participants').create(participant => {
                  participant.tripId = trip.id;
                  participant.userId = participantData.user;
                  participant.email = participantData.email;
                  participant.role = participantData.role;
                  participant.status = participantData.status;
                  participant.serverId = participantData._id;
                  participant.isSynced = true;
                });
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('Error pulling participants:', error);
    }
  }

  async syncItineraryItems() {
    // Push local changes
    const unsyncedItems = await database.get('itinerary_items')
      .query(Q.where('is_synced', false))
      .fetch();

    for (const item of unsyncedItems) {
      try {
        const itemData = item.prepareForSync();
        const response = await api.createItineraryItem(item.tripId, itemData);
        if (response.success) {
          await item.markAsSynced(response.data._id);
        }
      } catch (error) {
        console.error('Error syncing itinerary item:', error);
      }
    }

    // Pull server changes
    try {
      const trips = await database.get('trips').fetch();
      for (const trip of trips) {
        const response = await api.getItinerary(trip.serverId);
        if (response.success) {
          await database.write(async () => {
            for (const itemData of response.data) {
              const existingItem = await database.get('itinerary_items')
                .query(Q.where('server_id', itemData._id))
                .fetch();

              if (existingItem.length === 0) {
                await database.get('itinerary_items').create(item => {
                  item.tripId = trip.id;
                  item.day = itemData.day;
                  item.title = itemData.title;
                  item.description = itemData.description;
                  item.location = itemData.location;
                  item.lat = itemData.coordinates?.lat;
                  item.lon = itemData.coordinates?.lon;
                  item.displayName = itemData.coordinates?.displayName;
                  item.startTime = itemData.startTime ? new Date(itemData.startTime) : null;
                  item.endTime = itemData.endTime ? new Date(itemData.endTime) : null;
                  item.order = itemData.order;
                  item.serverId = itemData._id;
                  item.isSynced = true;
                });
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('Error pulling itinerary items:', error);
    }
  }

  async syncMessages() {
    // Push local changes
    const unsyncedMessages = await database.get('messages')
      .query(Q.where('is_synced', false))
      .fetch();

    for (const message of unsyncedMessages) {
      try {
        const messageData = message.prepareForSync();
        const response = await api.sendMessage(message.tripId, messageData);
        if (response.success) {
          await message.markAsSynced(response.data._id);
        }
      } catch (error) {
        console.error('Error syncing message:', error);
      }
    }

    // Pull server changes
    try {
      const trips = await database.get('trips').fetch();
      for (const trip of trips) {
        const response = await api.getMessages(trip.serverId);
        if (response.success) {
          await database.write(async () => {
            for (const messageData of response.data) {
              const existingMessage = await database.get('messages')
                .query(Q.where('server_id', messageData._id))
                .fetch();

              if (existingMessage.length === 0) {
                await database.get('messages').create(message => {
                  message.tripId = trip.id;
                  message.senderId = messageData.sender;
                  message.content = messageData.content;
                  message.type = messageData.type;
                  message.mediaUrl = messageData.mediaUrl;
                  message.latitude = messageData.location?.latitude;
                  message.longitude = messageData.location?.longitude;
                  message.readBy = JSON.stringify(messageData.readBy || []);
                  message.deleted = messageData.deleted;
                  message.deletedFor = JSON.stringify(messageData.deletedFor || []);
                  message.serverId = messageData._id;
                  message.isSynced = true;
                });
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('Error pulling messages:', error);
    }
  }

  async syncExpenses() {
    // Push local changes
    const unsyncedExpenses = await database.get('expenses')
      .query(Q.where('is_synced', false))
      .fetch();

    for (const expense of unsyncedExpenses) {
      try {
        const expenseData = expense.prepareForSync();
        const response = await api.createExpense(expense.tripId, expenseData);
        if (response.success) {
          await expense.markAsSynced(response.data._id);
          
          // Sync expense splits
          const splits = await expense.splits.fetch();
          for (const split of splits) {
            const splitData = split.prepareForSync();
            await api.addExpenseSplit(response.data._id, splitData);
            await split.markAsSynced(splitData.id);
          }
        }
      } catch (error) {
        console.error('Error syncing expense:', error);
      }
    }

    // Pull server changes
    try {
      const trips = await database.get('trips').fetch();
      for (const trip of trips) {
        const response = await api.getExpenses(trip.serverId);
        if (response.success) {
          await database.write(async () => {
            for (const expenseData of response.data) {
              const existingExpense = await database.get('expenses')
                .query(Q.where('server_id', expenseData._id))
                .fetch();

              if (existingExpense.length === 0) {
                const expense = await database.get('expenses').create(exp => {
                  exp.tripId = trip.id;
                  exp.createdBy = expenseData.createdBy;
                  exp.description = expenseData.description;
                  exp.amount = expenseData.amount;
                  exp.date = new Date(expenseData.date);
                  exp.paidBy = expenseData.paidBy;
                  exp.splitType = expenseData.splitType;
                  exp.splitWith = JSON.stringify(expenseData.splitWith || []);
                  exp.serverId = expenseData._id;
                  exp.isSynced = true;
                });

                // Create expense splits
                for (const splitData of expenseData.splitWith || []) {
                  await database.get('expense_splits').create(split => {
                    split.expenseId = expense.id;
                    split.email = splitData.email;
                    split.amount = splitData.amount;
                    split.serverId = splitData.id;
                    split.isSynced = true;
                  });
                }
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('Error pulling expenses:', error);
    }
  }

  async syncDocuments() {
    // Push local changes
    const unsyncedDocuments = await database.get('documents')
      .query(Q.where('is_synced', false))
      .fetch();

    for (const document of unsyncedDocuments) {
      try {
        const documentData = document.prepareForSync();
        const response = await api.uploadDocument(document.tripId, documentData);
        if (response.success) {
          await document.markAsSynced(response.data._id);
        }
      } catch (error) {
        console.error('Error syncing document:', error);
      }
    }

    // Pull server changes
    try {
      const trips = await database.get('trips').fetch();
      for (const trip of trips) {
        const response = await api.getDocuments(trip.serverId);
        if (response.success) {
          await database.write(async () => {
            for (const documentData of response.data) {
              const existingDocument = await database.get('documents')
                .query(Q.where('server_id', documentData._id))
                .fetch();

              if (existingDocument.length === 0) {
                await database.get('documents').create(document => {
                  document.tripId = trip.id;
                  document.name = documentData.name;
                  document.type = documentData.type;
                  document.url = documentData.url;
                  document.size = documentData.size;
                  document.uploadedBy = documentData.uploadedBy;
                  document.serverId = documentData._id;
                  document.isSynced = true;
                });
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('Error pulling documents:', error);
    }
  }

  // Helper methods for offline operations
  async createTrip(tripData) {
    return database.write(async () => {
      const trip = await database.get('trips').create(trip => {
        trip.name = tripData.name;
        trip.description = tripData.description;
        trip.creatorId = tripData.creator;
        trip.startDate = tripData.startDate ? new Date(tripData.startDate) : null;
        trip.endDate = tripData.endDate ? new Date(tripData.endDate) : null;
        trip.isSynced = false;
      });

      if (this.isOnline) {
        try {
          const response = await api.createTrip(tripData);
          if (response.success) {
            await trip.markAsSynced(response.data._id);
          }
        } catch (error) {
          console.error('Error creating trip:', error);
        }
      }

      return trip;
    });
  }

  async addParticipant(tripId, participantData) {
    return database.write(async () => {
      const participant = await database.get('participants').create(p => {
        p.tripId = tripId;
        p.userId = participantData.user;
        p.email = participantData.email;
        p.role = participantData.role;
        p.status = participantData.status;
        p.isSynced = false;
      });

      if (this.isOnline) {
        try {
          const response = await api.addParticipant(tripId, participantData);
          if (response.success) {
            await participant.markAsSynced(response.data._id);
          }
        } catch (error) {
          console.error('Error adding participant:', error);
        }
      }

      return participant;
    });
  }

  async createItineraryItem(tripId, itemData) {
    return database.write(async () => {
      const item = await database.get('itinerary_items').create(i => {
        i.tripId = tripId;
        i.day = itemData.day;
        i.title = itemData.title;
        i.description = itemData.description;
        i.location = itemData.location;
        i.lat = itemData.coordinates?.lat;
        i.lon = itemData.coordinates?.lon;
        i.displayName = itemData.coordinates?.displayName;
        i.startTime = itemData.startTime ? new Date(itemData.startTime) : null;
        i.endTime = itemData.endTime ? new Date(itemData.endTime) : null;
        i.order = itemData.order;
        i.isSynced = false;
      });

      if (this.isOnline) {
        try {
          const response = await api.createItineraryItem(tripId, itemData);
          if (response.success) {
            await item.markAsSynced(response.data._id);
          }
        } catch (error) {
          console.error('Error creating itinerary item:', error);
        }
      }

      return item;
    });
  }

  async sendMessage(tripId, messageData) {
    return database.write(async () => {
      const message = await database.get('messages').create(m => {
        m.tripId = tripId;
        m.senderId = messageData.sender;
        m.content = messageData.content;
        m.type = messageData.type;
        m.mediaUrl = messageData.mediaUrl;
        m.latitude = messageData.location?.latitude;
        m.longitude = messageData.location?.longitude;
        m.readBy = JSON.stringify(messageData.readBy || []);
        m.deleted = messageData.deleted;
        m.deletedFor = JSON.stringify(messageData.deletedFor || []);
        m.isSynced = false;
      });

      if (this.isOnline) {
        try {
          const response = await api.sendMessage(tripId, messageData);
          if (response.success) {
            await message.markAsSynced(response.data._id);
          }
        } catch (error) {
          console.error('Error sending message:', error);
        }
      }

      return message;
    });
  }

  async createExpense(tripId, expenseData) {
    return database.write(async () => {
      const expense = await database.get('expenses').create(e => {
        e.tripId = tripId;
        e.createdBy = expenseData.createdBy;
        e.description = expenseData.description;
        e.amount = expenseData.amount;
        e.date = new Date(expenseData.date);
        e.paidBy = expenseData.paidBy;
        e.splitType = expenseData.splitType;
        e.splitWith = JSON.stringify(expenseData.splitWith || []);
        e.isSynced = false;
      });

      // Create expense splits
      for (const splitData of expenseData.splitWith || []) {
        await database.get('expense_splits').create(split => {
          split.expenseId = expense.id;
          split.email = splitData.email;
          split.amount = splitData.amount;
          split.isSynced = false;
        });
      }

      if (this.isOnline) {
        try {
          const response = await api.createExpense(tripId, expenseData);
          if (response.success) {
            await expense.markAsSynced(response.data._id);
            
            // Sync expense splits
            const splits = await expense.splits.fetch();
            for (const split of splits) {
              const splitData = split.prepareForSync();
              await api.addExpenseSplit(response.data._id, splitData);
              await split.markAsSynced(splitData.id);
            }
          }
        } catch (error) {
          console.error('Error creating expense:', error);
        }
      }

      return expense;
    });
  }

  async uploadDocument(tripId, documentData) {
    return database.write(async () => {
      const document = await database.get('documents').create(d => {
        d.tripId = tripId;
        d.name = documentData.name;
        d.type = documentData.type;
        d.url = documentData.url;
        d.size = documentData.size;
        d.uploadedBy = documentData.uploadedBy;
        d.isSynced = false;
      });

      if (this.isOnline) {
        try {
          const response = await api.uploadDocument(tripId, documentData);
          if (response.success) {
            await document.markAsSynced(response.data._id);
          }
        } catch (error) {
          console.error('Error uploading document:', error);
        }
      }

      return document;
    });
  }
}

export default new OfflineService(); 