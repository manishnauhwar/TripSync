import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, text, relation, action } from '@nozbe/watermelondb/decorators';

export default class ItineraryItem extends Model {
  static table = 'itinerary_items';

  static associations = {
    trips: { type: 'belongs_to', key: 'trip_id' },
  };

  @text('trip_id') tripId;
  @field('day') day;
  @text('title') title;
  @text('description') description;
  @text('location') location;
  @date('start_time') startTime;
  @date('end_time') endTime;
  @field('order') order;
  @text('server_id') serverId;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;
  @field('is_synced') isSynced;

  @relation('trips', 'trip_id') trip;

  @action async markAsSynced(serverId) {
    return this.update(item => {
      item.serverId = serverId;
      item.isSynced = true;
    });
  }

  @action async markAsUnsynced() {
    return this.update(item => {
      item.isSynced = false;
    });
  }

  // Helper method to prepare itinerary item data for API
  prepareForSync() {
    return {
      id: this.serverId,
      day: this.day,
      title: this.title,
      description: this.description,
      location: this.location,
      startTime: this.startTime?.toISOString(),
      endTime: this.endTime?.toISOString(),
      order: this.order,
    };
  }
} 