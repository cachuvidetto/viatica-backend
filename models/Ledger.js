const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema({
  pharmacist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  type: {
    type: String,
    enum: ['debt', 'payment'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String
  },
  transactionDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Prevent creating duplicate "debt" entries for the same order
ledgerSchema.index(
  { order: 1, type: 1 },
  { unique: true, partialFilterExpression: { order: { $exists: true }, type: 'debt' } }
);

const Ledger = mongoose.model('Ledger', ledgerSchema);
module.exports = Ledger;
