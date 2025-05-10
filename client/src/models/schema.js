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
        { name: 'lat', type: 'number', isOptional: true },
        { name: 'lon', type: 'number', isOptional: true },
        { name: 'display_name', type: 'string', isOptional: true },
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
        { name: 'type', type: 'string' },
        { name: 'media_url', type: 'string', isOptional: true },
        { name: 'latitude', type: 'number', isOptional: true },
        { name: 'longitude', type: 'number', isOptional: true },
        { name: 'read_by', type: 'string', isOptional: true },
        { name: 'deleted', type: 'boolean' },
        { name: 'deleted_for', type: 'string', isOptional: true },
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
        { name: 'description', type: 'string' },
        { name: 'amount', type: 'number' },
        { name: 'date', type: 'number' },
        { name: 'paid_by', type: 'string' },
        { name: 'split_type', type: 'string' },
        { name: 'split_with', type: 'string' },
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'is_synced', type: 'boolean' },
      ]
    }),
    tableSchema({
      name: 'expense_splits',
      columns: [
        { name: 'expense_id', type: 'string', isIndexed: true },
        { name: 'email', type: 'string' },
        { name: 'amount', type: 'number' },
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'is_synced', type: 'boolean' },
      ]
    }),
    tableSchema({
      name: 'documents',
      columns: [
        { name: 'trip_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'type', type: 'string' },
        { name: 'url', type: 'string' },
        { name: 'size', type: 'number' },
        { name: 'uploaded_by', type: 'string' },
        { name: 'server_id', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'is_synced', type: 'boolean' },
      ]
    })
  ]
}); 