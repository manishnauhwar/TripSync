import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, text, relation, action } from '@nozbe/watermelondb/decorators';

export default class Expense extends Model {
  static table = 'expenses';

  static associations = {
    trips: { type: 'belongs_to', key: 'trip_id' },
  };

  @text('trip_id') tripId;
  @text('created_by') createdBy;
  @text('title') title;
  @field('amount') amount;
  @text('currency') currency;
  @date('date') date;
  @text('category') category;
  @text('split_type') splitType;
  @text('server_id') serverId;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;
  @field('is_synced') isSynced;

  @relation('trips', 'trip_id') trip;

  @action async markAsSynced(serverId) {
    return this.update(expense => {
      expense.serverId = serverId;
      expense.isSynced = true;
    });
  }

  @action async markAsUnsynced() {
    return this.update(expense => {
      expense.isSynced = false;
    });
  }

  // Helper method to prepare expense data for API
  prepareForSync() {
    return {
      id: this.serverId,
      trip: this.tripId,
      createdBy: this.createdBy,
      title: this.title,
      amount: this.amount,
      currency: this.currency,
      date: this.date?.toISOString(),
      category: this.category,
      splitType: this.splitType,
    };
  }
} 