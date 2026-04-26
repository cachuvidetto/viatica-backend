const mongoose = require('mongoose');

const drugSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'A drug must have a name'],
    trim: true,
    maxlength: [100, 'A drug name must have less or equal than 100 characters'],
    minlength: [3, 'A drug name must have more or equal than 3 characters']
  },
  genericName: {
    type: String,
    required: [true, 'A drug must have a generic name']
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: [true, 'A drug must belong to a category'],
    enum: {
      values: ['antibiotic', 'analgesic', 'antihistamine', 'antidepressant', 'cosmetics', 'other'],
      message: 'Category is either: antibiotic, analgesic, antihistamine, antidepressant, cosmetics, other'
    }
  },
  quantity: {
    type: Number,
    required: [true, 'A drug must have a quantity'],
    min: [0, 'Quantity must be above 0']
  },
  price: {
    type: Number,
    required: [true, 'A drug must have a price'],
    min: [0, 'Price must be above 0']
  },
  costPrice: {
    type: Number,
    min: [0, 'Cost price must be above 0'],
    default: 0
  },
  priceUSD: {
    type: Number,
    min: [0, 'Price in USD must be above 0']
  },
  publicPrice: {
    type: Number,
    min: [0, 'Public price must be above 0']
  },
  minThreshold: {
    type: Number,
    default: 10,
    min: [0, 'Minimum threshold must be 0 or above']
  },
  barcode: {
    type: String,
    trim: true,
    index: true
  },
  expiryDate: {
    type: Date,
    required: [true, 'A drug must have an expiry date']
  },
  warehouse: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'A drug must belong to a warehouse']
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  batchNumber: {
    type: String,
    required: [true, 'A drug must have a batch number']
  },
  manufacturer: {
    type: String,
    required: [true, 'A drug must have a manufacturer']
  },
  dosage: {
    type: String,
    trim: true,
    required: [true, 'A drug must have a dosage (e.g., 500mg)']
  },
  dosageForm: {
    type: String,
    required: [true, 'A drug must have a dosage form'],
    enum: {
      values: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Cream', 'Drops', 'Other'],
      message: 'Dosage form is not supported'
    }
  },
  activeIngredients: [
    {
      type: String,
      trim: true
    }
  ],
  indications: {
    type: String,
    trim: true
  },
  sideEffects: [
    {
      type: String,
      trim: true
    }
  ],
  storageInstructions: {
    type: String,
    trim: true,
    default: 'Store in a cool, dry place away from direct sunlight.'
  }
});

// Indexes
drugSchema.index({ name: 'text', genericName: 'text', activeIngredients: 'text' });
drugSchema.index({ name: 1, warehouse: 1 }, { unique: true });
drugSchema.index({ expiryDate: 1 });
drugSchema.index({ warehouse: 1 });

// Query middleware to populate warehouse
drugSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'warehouse',
    select: 'name email phone'
  });
  next();
});

const Drug = mongoose.model('Drug', drugSchema);
module.exports = Drug;