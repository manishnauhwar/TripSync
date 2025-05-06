import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { useSync } from '../hooks/useSync';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const SyncIndicator = () => {
  const { isOnline, isSyncing, lastSync, manualSync } = useSync();

  const formatLastSync = () => {
    if (!lastSync) return 'Never';
    return format(lastSync, 'MMM d, h:mm a');
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <View style={[styles.indicatorDot, {
          backgroundColor: isOnline ? '#4CAF50' : '#F44336'
        }]} />
        <Text style={styles.statusText}>
          {isOnline ? 'Online' : 'Offline'}
        </Text>
      </View>

      {isSyncing ? (
        <View style={styles.syncingContainer}>
          <Icon name="sync" size={18} color="#2196F3" style={styles.spinningIcon} />
          <Text style={styles.syncingText}>Syncing...</Text>
        </View>
      ) : (
        <TouchableOpacity 
          style={styles.syncButton} 
          onPress={manualSync}
          disabled={!isOnline}
        >
          <Icon name="sync" size={18} color={isOnline ? '#2196F3' : '#9E9E9E'} />
          <Text style={[styles.syncText, { color: isOnline ? '#2196F3' : '#9E9E9E' }]}>
            Sync Now
          </Text>
        </TouchableOpacity>
      )}

      <Text style={styles.lastSyncText}>
        Last sync: {formatLastSync()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    margin: 10,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  indicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  syncingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  spinningIcon: {
    marginRight: 5,
  },
  syncingText: {
    color: '#2196F3',
    fontSize: 14,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
  },
  syncText: {
    marginLeft: 5,
    fontSize: 14,
  },
  lastSyncText: {
    fontSize: 12,
    color: '#757575',
    marginTop: 5,
  },
});

export default SyncIndicator; 