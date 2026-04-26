const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
  drug: { type: mongoose.Schema.Types.ObjectId, ref: 'Drug', required: true },
  drugName: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitType: { type: String, enum: ['unit', 'carton'], default: 'unit' },
  costPrice: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true }
}, { _id: false });

const purchaseSchema = new mongoose.Schema({
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: true
  },
  invoiceNumber: {
    type: String,
    trim: true,
    default: ''
  },
  items: [purchaseItemSchema],
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  total: { type: Number, required: true },
  paymentStatus: {
    type: String,
    enum: ['paid', 'credit', 'partial'],
    default: 'paid'
  },
  paidAmount: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

purchaseSchema.index({ warehouse: 1, createdAt: -1 });
purchaseSchema.index({ supplier: 1 });

module.exports = mongoose.model('Purchase', purchaseSchema);
