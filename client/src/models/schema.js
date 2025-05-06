import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'trips',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'creator_id', type: 'string' },
        { name: 'start_date', type: 'number', isOptional: true },
        { name: 'end_date', type: 'number', isOptional: true },
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'is_synced', type: 'boolean' },
      ]
    }),
    tableSchema({
      name: 'participants',
      columns: [
        { name: 'trip_id', type: 'string', isIndexed: true },
        { name: 'user_id', type: 'string', isOptional: true },
        { name: 'email', type: 'string' },
        { name: 'role', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'is_synced', type: 'boolean' },
      ]
    }),
    tableSchema({
      name: 'itinerary_items',
      columns: [
        { name: 'trip_id', type: 'string', isIndexed: true },
        { name: 'day', type: 'number' },
        { name: 'title', type: 'string' },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'location', type: 'string', isOptional: true },
        { name: 'start_time', type: 'number', isOptional: true },
        { name: 'end_time', type: 'number', isOptional: true },
        { name: 'order', type: 'number' },
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'is_synced', type: 'boolean' },
      ]
    }),
    tableSchema({
      name: 'messages',
      columns: [
        { name: 'trip_id', type: 'string', isIndexed: true },
        { name: 'sender_id', type: 'string' },
        { name: 'content', type: 'string' },
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'is_synced', type: 'boolean' },
      ]
    }),
    tableSchema({
      name: 'expenses',
      columns: [
        { name: 'trip_id', type: 'string', isIndexed: true },
        { name: 'created_by', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'amount', type: 'number' },
        { name: 'currency', type: 'string' },
        { name: 'date', type: 'number' },
        { name: 'category', type: 'string', isOptional: true },
        { name: 'split_type', type: 'string' },
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'is_synced', type: 'boolean' },
      ]
    }),
  ]
}); 