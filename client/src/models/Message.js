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
  @text('type') type;
  @text('media_url') mediaUrl;
  @field('latitude') latitude;
  @field('longitude') longitude;
  @text('read_by') readBy;
  @field('deleted') deleted;
  @text('deleted_for') deletedFor;
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

  @action async markAsRead(userId) {
    const currentReadBy = this.readBy ? JSON.parse(this.readBy) : [];
    if (!currentReadBy.includes(userId)) {
      currentReadBy.push(userId);
      return this.update(message => {
        message.readBy = JSON.stringify(currentReadBy);
      });
    }
  }

  @action async markAsDeleted(userId) {
    const currentDeletedFor = this.deletedFor ? JSON.parse(this.deletedFor) : [];
    if (!currentDeletedFor.includes(userId)) {
      currentDeletedFor.push(userId);
      return this.update(message => {
        message.deletedFor = JSON.stringify(currentDeletedFor);
        message.deleted = currentDeletedFor.length > 0;
      });
    }
  }

  // Helper method to prepare message data for API
  prepareForSync() {
    return {
      id: this.serverId,
      trip: this.tripId,
      sender: this.senderId,
      content: this.content,
      type: this.type,
      mediaUrl: this.mediaUrl,
      location: this.latitude && this.longitude ? {
        latitude: this.latitude,
        longitude: this.longitude
      } : null,
      readBy: this.readBy ? JSON.parse(this.readBy) : [],
      deleted: this.deleted,
      deletedFor: this.deletedFor ? JSON.parse(this.deletedFor) : [],
      createdAt: this.createdAt?.toISOString(),
    };
  }
} 