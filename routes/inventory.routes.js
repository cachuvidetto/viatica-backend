const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const catchAsync = require('../utils/catchAsync');
const PharmacistStock = require('../models/PharmacistStock');
const AppError = require('../utils/appError');
const StockMovement = require('../models/StockMovement');

// Protected routes
router.use(auth.protect);

// Get Pharmacist's own stock
router.get('/my-stock', auth.restrictTo('pharmacist'), catchAsync(async (req, res) => {
  const stock = await PharmacistStock.find({ pharmacist: req.user._id })
    .populate('drug', 'name genericName category manufacturer')
    .sort('drug.name');
    
  res.status(200).json({ status: 'success', results: stock.length, data: { stock } });
}));

// Manually update stock (e.g. sale or adjustment)
router.patch('/:id/adjust', auth.restrictTo('pharmacist'), catchAsync(async (req, res, next) => {
  const { quantity } = req.body; // New absolute quantity
  const newQty = Number(quantity);
  if (!Number.isFinite(newQty) || newQty < 0) return next(new AppError('Quantity غير صالحة', 400));

  const before = await PharmacistStock.findOne({ _id: req.params.id, pharmacist: req.user._id }).select('quantity drug').lean();
  const stock = await PharmacistStock.findOneAndUpdate(
    { _id: req.params.id, pharmacist: req.user._id },
    { quantity: newQty },
    { new: true }
  );
  
  if (!stock) return next(new AppError('Item not found', 404));

  // Record pharmacist stock movement (as stock owner = pharmacist user)
  if (before) {
    const diff = newQty - (before.quantity || 0);
    if (diff !== 0) {
      await StockMovement.create({
        warehouse: req.user._id,
        drug: before.drug,
        type: 'adjustment',
        direction: diff > 0 ? 'in' : 'out',
        quantity: Math.abs(diff),
        unitType: 'unit',
        packingSize: 1,
        quantityUnits: Math.abs(diff),
        beforeQty: before.quantity || 0,
        afterQty: newQty,
        referenceModel: 'PharmacistStock',
        referenceId: stock._id,
        actor: req.user._id,
        notes: 'Pharmacist stock manual adjustment'
      });
    }
  }
  res.status(200).json({ status: 'success', data: { stock } });
}));

module.exports = router;
