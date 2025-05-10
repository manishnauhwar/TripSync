import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, text, relation, action, children } from '@nozbe/watermelondb/decorators';

export default class Expense extends Model {
  static table = 'expenses';

  static associations = {
    trips: { type: 'belongs_to', key: 'trip_id' },
    expense_splits: { type: 'has_many', foreignKey: 'expense_id' },
  };

  @text('trip_id') tripId;
  @text('created_by') createdBy;
  @text('description') description;
  @field('amount') amount;
  @date('date') date;
  @text('paid_by') paidBy;
  @text('split_type') splitType;
  @text('split_with') splitWith;
  @text('server_id') serverId;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;
  @field('is_synced') isSynced;

  @relation('trips', 'trip_id') trip;
  @children('expense_splits') splits;

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

  @action async addSplit(email, amount) {
    return this.collections.get('expense_splits').create(split => {
      split.expenseId = this.id;
      split.email = email;
      split.amount = amount;
      split.isSynced = false;
    });
  }

  @action async updateSplits(splits) {
    // Delete existing splits
    const existingSplits = await this.splits.fetch();
    await this.collections.get('expense_splits').destroyPermanently(existingSplits);

    // Create new splits
    for (const split of splits) {
      await this.addSplit(split.email, split.amount);
    }
  }

  // Helper method to prepare expense data for API
  prepareForSync() {
    return {
      id: this.serverId,
      trip: this.tripId,
      createdBy: this.createdBy,
      description: this.description,
      amount: this.amount,
      date: this.date?.toISOString(),
      paidBy: this.paidBy,
      splitType: this.splitType,
      splitWith: this.splitWith ? JSON.parse(this.splitWith) : [],
    };
  }
} 