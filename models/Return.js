const mongoose = require('mongoose');

const returnSchema = new mongoose.Schema({
  originalOrder: {
    type: mongoose.Schema.ObjectId,
    ref: 'Order',
    required: true
  },
  pharmacist: {
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  },
  warehouse: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  returnedDrugs: [
    {
      drug: {
        type: mongoose.Schema.ObjectId,
        ref: 'Drug',
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      },
      price: {
        type: Number,
        required: true
      },
      reason: {
        type: String,
        default: 'عتب / مرتجع عادي'
      }
    }
  ],
  totalRefundAmount: {
    type: Number,
    required: true,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved'
  },
  notes: String
}, {
  timestamps: true
});

module.exports = mongoose.model('Return', returnSchema);
