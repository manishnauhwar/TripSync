import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, text, relation, action } from '@nozbe/watermelondb/decorators';

export default class Participant extends Model {
  static table = 'participants';

  static associations = {
    trips: { type: 'belongs_to', key: 'trip_id' },
  };

  @text('trip_id') tripId;
  @text('user_id') userId;
  @text('email') email;
  @text('role') role;
  @text('status') status;
  @text('server_id') serverId;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;
  @field('is_synced') isSynced;

  @relation('trips', 'trip_id') trip;

  @action async markAsSynced(serverId) {
    return this.update(participant => {
      participant.serverId = serverId;
      participant.isSynced = true;
    });
  }

  @action async markAsUnsynced() {
    return this.update(participant => {
      participant.isSynced = false;
    });
  }

  // Helper method to prepare participant data for API
  prepareForSync() {
    return {
      id: this.serverId,
      user: this.userId,
      email: this.email,
      role: this.role,
      status: this.status,
    };
  }
} 