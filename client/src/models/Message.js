import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, text, relation, action } from '@nozbe/watermelondb/decorators';

export default class Message extends Model {
  static table = 'messages';

  static associations = {
    trips: { type: 'belongs_to', key: 'trip_id' },
  };

  @text('trip_id') tripId;
  @text('sender_id') senderId;
  @text('content') content;
  @text('server_id') serverId;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;
  @field('is_synced') isSynced;

  @relation('trips', 'trip_id') trip;

  @action async markAsSynced(serverId) {
    return this.update(message => {
      message.serverId = serverId;
      message.isSynced = true;
    });
  }

  @action async markAsUnsynced() {
    return this.update(message => {
      message.isSynced = false;
    });
  }

  // Helper method to prepare message data for API
  prepareForSync() {
    return {
      id: this.serverId,
      trip: this.tripId,
      sender: this.senderId,
      content: this.content,
      createdAt: this.createdAt?.toISOString(),
    };
  }
} 