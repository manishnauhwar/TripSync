import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { Platform } from 'react-native';

import schema from './schema';
import migrations from './migrations';

import Trip from './Trip';
import Participant from './Participant';
import ItineraryItem from './ItineraryItem';
import Message from './Message';
import Expense from './Expense';

console.log('Initializing WatermelonDB...');

const dbName = 'tripsync.db';

// Database config options
const adapterConfig = {
  schema,
  migrations,
  dbName,
  // Only use JSI on iOS for now, due to potential issues with Android and Hermes
  jsi: Platform.OS === 'ios', 
  onSetUpError: error => {
    console.error('WatermelonDB setup failed:', error);
  }
};

// Create the adapter
let adapter;
try {
  console.log(`Creating SQLite adapter with config: ${JSON.stringify({
    ...adapterConfig,
    schema: '[schema object]', 
    migrations: '[migrations object]'
  })}`);
  
  adapter = new SQLiteAdapter(adapterConfig);
  console.log('SQLite adapter created successfully');
} catch (error) {
  console.error('Failed to create SQLite adapter:', error);
  
  // Fallback to simpler config if creating the adapter failed
  try {
    adapter = new SQLiteAdapter({
      schema,
      dbName,
      jsi: false
    });
    console.log('Created fallback SQLite adapter');
  } catch (fallbackError) {
    console.error('Failed to create fallback adapter:', fallbackError);
    throw new Error('Failed to initialize database adapter');
  }
}

// Create the database
let database;
try {
  database = new Database({
    adapter,
    modelClasses: [
      Trip,
      Participant,
      ItineraryItem,
      Message,
      Expense
    ],
  });
  console.log('WatermelonDB database initialized successfully');
} catch (error) {
  console.error('Failed to initialize WatermelonDB database:', error);
  throw new Error('Failed to initialize database');
}

if (!database) {
  throw new Error('Database initialization failed');
}

export {
  database,
  Trip,
  Participant,
  ItineraryItem,
  Message,
  Expense
}; 