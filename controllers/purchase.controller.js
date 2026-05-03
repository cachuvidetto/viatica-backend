const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Purchase = require('../models/Purchase');
const Drug = require('../models/Drug');
const mongoose = require('mongoose');
const StockMovement = require('../models/StockMovement');

// Create purchase + auto-update stock & costPrice
exports.createPurchase = catchAsync(async (req, res, next) => {
  const { supplier, invoiceNumber, items, discount, paymentStatus, paidAmount, notes, date } = req.body;
  const warehouseId = req.user._id;

  if (!items || items.length === 0) {
    return next(new AppError('يجب إضافة صنف واحد على الأقل', 400));
  }

  const session = await mongoose.startSession();
  let purchase;
  try {
    await session.withTransaction(async () => {
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);
      const total = subtotal - (discount || 0);

      // Create the purchase record
      const created = await Purchase.create([{
        warehouse: warehouseId,
        supplier,
        invoiceNumber: invoiceNumber || '',
        items: items.map(i => ({
          drug: i.drug,
          drugName: i.drugName,
          quantity: i.quantity,
          unitType: i.unitType || 'unit',
          costPrice: i.costPrice,
          total: i.quantity * i.costPrice
        })),
        subtotal,
        discount: discount || 0,
        total,
        paymentStatus: paymentStatus || 'paid',
        paidAmount: paymentStatus === 'paid' ? total : (paidAmount || 0),
        notes: notes || '',
        date: date || new Date()
      }], { session });
      purchase = created[0];

      // Update stock quantities and costPrice for each drug
      for (const item of items) {
        let qtyToAdd = item.quantity;
        let packingSize = 1;

        // If purchased by carton, convert to individual units
        if (item.unitType === 'carton') {
          const drug = await Drug.findById(item.drug).select('packingSize').session(session);
          if (drug && drug.packingSize > 1) {
            packingSize = drug.packingSize;
            qtyToAdd = item.quantity * packingSize;
          }
        }

        const before = await Drug.findOne({ _id: item.drug, warehouse: warehouseId }).select('quantity').session(session);
        const updated = await Drug.findOneAndUpdate(
          { _id: item.drug, warehouse: warehouseId },
          {
            $inc: { quantity: qtyToAdd },
            $set: { costPrice: item.costPrice }
          },
          { session, new: true }
        );

        if (before && updated) {
          await StockMovement.create([{
            warehouse: warehouseId,
            drug: item.drug,
            type: 'purchase_in',
            direction: 'in',
            quantity: item.quantity,
            unitType: item.unitType === 'carton' ? 'carton' : 'unit',
            packingSize,
            quantityUnits: qtyToAdd,
            beforeQty: before.quantity,
            afterQty: updated.quantity,
            referenceModel: 'Purchase',
            referenceId: purchase._id,
            actor: req.user._id
          }], { session });
        }
      }
    });
  } finally {
    session.endSession();
  }

  // Populate supplier name for the response
  const populated = await Purchase.findById(purchase._id).populate('supplier', 'name company');

  res.status(201).json({
    status: 'success',
    message: `تم تسجيل فاتورة شراء بقيمة ${populated.total.toLocaleString()} ل.س وتحديث المخزون تلقائياً`,
    data: { purchase: populated }
  });
});

// Get all purchases (with optional filters)
exports.getPurchases = catchAsync(async (req, res) => {
  const { startDate, endDate, supplierId } = req.query;
  const filter = { warehouse: req.user._id };

  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate + 'T23:59:59');
  }
  if (supplierId && supplierId !== 'all') filter.supplier = supplierId;

  const purchases = await Purchase.find(filter)
    .populate('supplier', 'name company')
    .sort('-date')
    .lean();

  const totalSpent = purchases.reduce((s, p) => s + p.total, 0);

  res.status(200).json({
    status: 'success',
    data: {
      purchases,
      totalSpent,
      count: purchases.length
    }
  });
});

// Get single purchase
exports.getPurchase = catchAsync(async (req, res, next) => {
  const purchase = await Purchase.findOne({ _id: req.params.id, warehouse: req.user._id })
    .populate('supplier', 'name company phone');
  if (!purchase) return next(new AppError('لم يتم العثور على فاتورة الشراء', 404));
  res.status(200).json({ status: 'success', data: { purchase } });
});

// Delete purchase (reverse stock)
exports.deletePurchase = catchAsync(async (req, res, next) => {
  const purchase = await Purchase.findOne({ _id: req.params.id, warehouse: req.user._id });
  if (!purchase) return next(new AppError('لم يتم العثور على فاتورة الشراء', 404));

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Reverse stock
      for (const item of purchase.items) {
        let qtyToRemoveUnits = item.quantity;
        let packingSize = 1;

        // If it was purchased by carton, reverse using packingSize conversion
        if (item.unitType === 'carton') {
          const drug = await Drug.findById(item.drug).select('packingSize').session(session);
          if (drug && drug.packingSize > 1) {
            packingSize = drug.packingSize;
            qtyToRemoveUnits = item.quantity * packingSize;
          }
        }

        const before = await Drug.findOne({ _id: item.drug, warehouse: req.user._id }).select('quantity').session(session);
        const updated = await Drug.findOneAndUpdate(
          { _id: item.drug, warehouse: req.user._id },
          { $inc: { quantity: -qtyToRemoveUnits } },
          { session, new: true }
        );

        if (before && updated) {
          await StockMovement.create([{
            warehouse: req.user._id,
            drug: item.drug,
            type: 'purchase_cancel',
            direction: 'out',
            quantity: item.quantity,
            unitType: item.unitType === 'carton' ? 'carton' : 'unit',
            packingSize,
            quantityUnits: qtyToRemoveUnits,
            beforeQty: before.quantity,
            afterQty: updated.quantity,
            referenceModel: 'Purchase',
            referenceId: purchase._id,
            actor: req.user._id,
            notes: 'Purchase deleted (stock reversal)'
          }], { session });
        }
      }

      await Purchase.findByIdAndDelete(purchase._id).session(session);
    });
  } finally {
    session.endSession();
  }
  res.status(204).json({ status: 'success', data: null });
});

// Monthly purchase summary
exports.getPurchaseSummary = catchAsync(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthAgo30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [monthlyAgg, supplierAgg] = await Promise.all([
    Purchase.aggregate([
      { $match: { warehouse: req.user._id, date: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }
    ]),
    Purchase.aggregate([
      { $match: { warehouse: req.user._id, date: { $gte: monthAgo30 } } },
      { $group: { _id: '$supplier', total: { $sum: '$total' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'suppliers', localField: '_id', foreignField: '_id', as: 'info' } },
      { $unwind: { path: '$info', preserveNullAndEmptyArrays: true } },
      { $project: { name: '$info.name', company: '$info.company', total: 1, count: 1 } }
    ])
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      monthlyTotal: monthlyAgg[0]?.total || 0,
      monthlyCount: monthlyAgg[0]?.count || 0,
      topSuppliers: supplierAgg
    }
  });
});
