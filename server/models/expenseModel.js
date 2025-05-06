import mongoose from 'mongoose';

const splitSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  }
}, { _id: false });

const expenseSchema = new mongoose.Schema({
  description: {
    type: String,
    required: [true, 'Please provide a description'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Please provide an amount'],
    min: [0, 'Amount cannot be negative']
  },
  date: {
    type: Date,
    default: Date.now
  },
  trip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  paidBy: {
    type: String,
    required: [true, 'Please specify who paid']
  },
  splitType: {
    type: String,
    enum: ['equal', 'full'],
    default: 'equal'
  },
  splitWith: {
    type: [splitSchema],
    required: [true, 'Please provide split information']
  }
}, {
  timestamps: true
});

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense; 