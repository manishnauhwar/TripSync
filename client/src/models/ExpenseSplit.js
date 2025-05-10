import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, text, relation, action } from '@nozbe/watermelondb/decorators';

export default class ExpenseSplit extends Model {
  static table = 'expense_splits';

  static associations = {
    expenses: { type: 'belongs_to', key: 'expense_id' },
  };

  @text('expense_id') expenseId;
  @text('email') email;
  @field('amount') amount;
  @text('server_id') serverId;
  @readonly @date('created_at') createdAt;
  @readonly @date('updated_at') updatedAt;
  @field('is_synced') isSynced;

  @relation('expenses', 'expense_id') expense;

  @action async markAsSynced(serverId) {
    return this.update(split => {
      split.serverId = serverId;
      split.isSynced = true;
    });
  }

  @action async markAsUnsynced() {
    return this.update(split => {
      split.isSynced = false;
    });
  }

  // Helper method to prepare split data for API
  prepareForSync() {
    return {
      id: this.serverId,
      expense: this.expenseId,
      email: this.email,
      amount: this.amount,
    };
  }
} 