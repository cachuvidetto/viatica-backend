const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  category: {
    type: String,
    required: [true, 'يجب تحديد فئة المصروف'],
    enum: {
      values: ['rent', 'salaries', 'transport', 'utilities', 'maintenance', 'other'],
      message: 'فئة المصروف غير صالحة'
    }
  },
  amount: {
    type: Number,
    required: [true, 'يجب إدخال مبلغ المصروف'],
    min: [0, 'المبلغ يجب أن يكون أكبر من صفر']
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  date: {
    type: Date,
    default: Date.now
  },
  isRecurring: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

expenseSchema.index({ warehouse: 1, date: -1 });
expenseSchema.index({ category: 1 });

module.exports = mongoose.model('Expense', expenseSchema);
