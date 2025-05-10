import { Model } from '@nozbe/watermelondb';
import { field, date, children, readonly, text, relation, action } from '@nozbe/watermelondb/decorators';

export default class Trip extends Model {
  static table = 'trips';

  static associations = {
    participants: { type: 'has_many', foreignKey: 'trip_id' },
    itinerary_items: { type: 'has_many', foreignKey: 'trip_id' },
    messages: { type: 'has_many', foreignKey: 'trip_id' },
    expenses: { type: 'has_many', foreignKey: 'trip_id' },
    documents: { type: 'has_many', foreignKey: 'trip_id' },
  };

  @text('name') name;
  @text('description') description;
  @text('creator_id') creatorId;
  @date('start_date') startDate;
  @date('end_date') endDate;
  @text('server_id') serverId;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;
  @field('is_synced') isSynced;

  @children('participants') participants;
  @children('itinerary_items') itineraryItems;
  @children('messages') messages;
  @children('expenses') expenses;
  @children('documents') documents;

  @action async markAsSynced(serverId) {
    return this.update(trip => {
      trip.serverId = serverId;
      trip.isSynced = true;
    });
  }

  @action async markAsUnsynced() {
    return this.update(trip => {
      trip.isSynced = false;
    });
  }

  // Helper method to prepare trip data for API
  prepareForSync() {
    return {
      id: this.serverId,
      name: this.name,
      description: this.description,
      creator: this.creatorId,
      startDate: this.startDate?.toISOString(),
      endDate: this.endDate?.toISOString(),
    };
  }
} 