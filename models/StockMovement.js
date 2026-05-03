const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  drug: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Drug',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['purchase_in', 'purchase_cancel', 'sale_out', 'order_out', 'return_in', 'adjustment'],
    required: true,
    index: true
  },
  direction: {
    type: String,
    enum: ['in', 'out'],
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unitType: {
    type: String,
    enum: ['unit', 'carton'],
    default: 'unit'
  },
  packingSize: {
    type: Number,
    default: 1,
    min: 1
  },
  quantityUnits: {
    type: Number,
    required: true,
    min: 0
  },
  beforeQty: {
    type: Number,
    required: true,
    min: 0
  },
  afterQty: {
    type: Number,
    required: true,
    min: 0
  },
  referenceModel: {
    type: String,
    enum: ['Order', 'Purchase', 'Return', 'Drug', 'ManualSale', 'PharmacistStock'],
    default: 'Drug'
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, { timestamps: false });

stockMovementSchema.index({ warehouse: 1, createdAt: -1 });
stockMovementSchema.index({ warehouse: 1, drug: 1, createdAt: -1 });
stockMovementSchema.index({ warehouse: 1, type: 1, createdAt: -1 });
stockMovementSchema.index({ warehouse: 1, referenceModel: 1, referenceId: 1, createdAt: -1 });

module.exports = mongoose.model('StockMovement', stockMovementSchema);

