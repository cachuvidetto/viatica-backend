const mongoose = require('mongoose');

const invoiceLineSchema = new mongoose.Schema({
  drugName:     { type: String, required: true },
  manufacturer: { type: String },
  quantity:     { type: Number, required: true },
  unitPrice:    { type: Number, required: true },
  total:        { type: Number, required: true }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  // Link to original order (optional, for reference)
  order:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Invoice number (human-readable)
  invoiceNumber: { type: String, unique: true, sparse: true },

  // Snapshot of warehouse branding at invoice time
  warehouseSnapshot: {
    name:       String,
    logo:       String,
    phone:      String,
    address:    String,
    managerName:String,
    invoiceFooterText: String
  },

  // Customer info
  customerName:  String,
  customerPhone: String,

  // Line items (embedded snapshot — doesn't change if drug price changes later)
  items: [invoiceLineSchema],

  subtotal:    { type: Number, required: true },
  discount:    { type: Number, default: 0 },
  total:       { type: Number, required: true },

  paymentType: { type: String, enum: ['cash', 'credit'], default: 'cash' },
  status:      { type: String, enum: ['draft','issued','paid','cancelled'], default: 'issued' },
  notes:       String
}, { timestamps: true });

invoiceSchema.index({ warehouse: 1, createdAt: -1 });
invoiceSchema.index({ status: 1 });

// Auto-generate invoice number before saving
invoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const count = await this.constructor.countDocuments({ warehouse: this.warehouse });
    const pad = String(count + 1).padStart(4, '0');
    this.invoiceNumber = `INV-${pad}`;
  }
  next();
});

module.exports = mongoose.model('Invoice', invoiceSchema);
