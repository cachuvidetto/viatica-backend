const mongoose = require('mongoose');

const orderDrugSchema = new mongoose.Schema({
  drug: { type: mongoose.Schema.Types.ObjectId, ref: 'Drug', required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true, min: 0 },
  costPrice: { type: Number, default: 0 }, // Cost at the time of sale for Profit calculation
  isBonus: { type: Boolean, default: false },
  appliedOffer: { type: mongoose.Schema.Types.ObjectId, ref: 'Offer' }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  pharmacist: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // optional for manual sales
  warehouse:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driver:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  drugs: [orderDrugSchema],
  status: {
    type: String,
    enum: ['pending','confirmed','assigned','out_for_delivery','delivered','cancelled'],
    default: 'pending'
  },
  source: {
    type: String,
    enum: ['app', 'manual_pharmacy', 'manual_distributor', 'manual_other'],
    default: 'app'
  },
  customerName:  { type: String }, // for manual sales to non-registered clients
  customerPhone: { type: String },
  deliveryAddress: String,
  deliveryFee: { type: Number, default: 0 },
  isFreeDelivery: { type: Boolean, default: false },
  notes: String
}, { timestamps: true });

orderSchema.index({ pharmacist: 1, createdAt: -1 });
orderSchema.index({ warehouse: 1, createdAt: -1 });
orderSchema.index({ driver: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

module.exports = mongoose.model('Order', orderSchema);
