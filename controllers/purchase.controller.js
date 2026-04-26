const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Purchase = require('../models/Purchase');
const Drug = require('../models/Drug');
const mongoose = require('mongoose');

// Create purchase + auto-update stock & costPrice
exports.createPurchase = catchAsync(async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { supplier, invoiceNumber, items, discount, paymentStatus, paidAmount, notes, date } = req.body;
    const warehouseId = req.user._id;

    if (!items || items.length === 0) {
      return next(new AppError('يجب إضافة صنف واحد على الأقل', 400));
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0);
    const total = subtotal - (discount || 0);

    // Create the purchase record
    const purchase = await Purchase.create([{
      warehouse: warehouseId,
      supplier,
      invoiceNumber: invoiceNumber || '',
      items: items.map(i => ({
        drug: i.drug,
        drugName: i.drugName,
        quantity: i.quantity,
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

    // Update stock quantities and costPrice for each drug
    for (const item of items) {
      await Drug.findOneAndUpdate(
        { _id: item.drug, warehouse: warehouseId },
        {
          $inc: { quantity: item.quantity },
          $set: { costPrice: item.costPrice }
        },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    // Populate supplier name for the response
    const populated = await Purchase.findById(purchase[0]._id).populate('supplier', 'name company');

    res.status(201).json({
      status: 'success',
      message: `تم تسجيل فاتورة شراء بقيمة ${total.toLocaleString()} ل.س وتحديث المخزون تلقائياً`,
      data: { purchase: populated }
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
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

  // Reverse stock
  for (const item of purchase.items) {
    await Drug.findOneAndUpdate(
      { _id: item.drug, warehouse: req.user._id },
      { $inc: { quantity: -item.quantity } }
    );
  }

  await Purchase.findByIdAndDelete(purchase._id);
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
