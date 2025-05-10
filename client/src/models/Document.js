import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, text, relation, action } from '@nozbe/watermelondb/decorators';

export default class Document extends Model {
  static table = 'documents';

  static associations = {
    trips: { type: 'belongs_to', key: 'trip_id' },
  };

  @text('trip_id') tripId;
  @text('name') name;
  @text('type') type;
  @text('url') url;
  @field('size') size;
  @text('uploaded_by') uploadedBy;
  @text('server_id') serverId;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;
  @field('is_synced') isSynced;

  @relation('trips', 'trip_id') trip;

  @action async markAsSynced(serverId) {
    return this.update(document => {
      document.serverId = serverId;
      document.isSynced = true;
    });
  }

  @action async markAsUnsynced() {
    return this.update(document => {
      document.isSynced = false;
    });
  }

  // Helper method to prepare document data for API
  prepareForSync() {
    return {
      id: this.serverId,
      trip: this.tripId,
      name: this.name,
      type: this.type,
      url: this.url,
      size: this.size,
      uploadedBy: this.uploadedBy,
    };
  }
} 