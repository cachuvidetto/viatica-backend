const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Return = require('../models/Return');
const Order = require('../models/Order');
const Drug = require('../models/Drug');
const Ledger = require('../models/Ledger');
const mongoose = require('mongoose');

// Create a return for a delivered order
exports.createReturn = catchAsync(async (req, res, next) => {
  const { orderId, returnedDrugs, notes } = req.body;

  if (!orderId || !returnedDrugs || returnedDrugs.length === 0) {
    return next(new AppError('يجب تحديد الطلب والأصناف المُرجعة', 400));
  }

  // Fetch original order
  const order = await Order.findOne({
    _id: orderId,
    warehouse: req.user._id
  }).populate('drugs.drug');

  if (!order) return next(new AppError('لا يوجد طلب بهذا المعرف أو لا تملك صلاحية الوصول', 404));
  if (!['delivered'].includes(order.status)) {
    return next(new AppError('لا يمكن إرجاع طلب لم يُسلَّم بعد', 400));
  }

  // Validate returned items against original order
  let totalRefundAmount = 0;
  const validatedItems = [];

  for (const item of returnedDrugs) {
    const originalItem = order.drugs.find(d => d.drug._id.toString() === item.drug);
    if (!originalItem) {
      return next(new AppError(`الصنف ${item.drug} غير موجود في الطلب الأصلي`, 400));
    }
    if (item.quantity > originalItem.quantity) {
      return next(new AppError(`الكمية المُرجعة للصنف "${originalItem.drug.name}" أكبر من المشتراة`, 400));
    }

    const refundAmount = item.quantity * originalItem.price;
    totalRefundAmount += refundAmount;

    validatedItems.push({
      drug: item.drug,
      quantity: item.quantity,
      price: originalItem.price,
      reason: item.reason || 'مرتجع عادي'
    });
  }

  // Create the return record
  const returnRecord = await Return.create({
    originalOrder: orderId,
    pharmacist: order.pharmacist,
    warehouse: req.user._id,
    returnedDrugs: validatedItems,
    totalRefundAmount,
    notes,
    status: 'approved'
  });

  // 1. Restore stock to warehouse inventory
  for (const item of validatedItems) {
    await Drug.findByIdAndUpdate(item.drug, {
      $inc: { quantity: item.quantity }
    });
  }

  // 2. Record financial credit entry (نقصان الديون) if pharmacist is registered
  if (order.pharmacist) {
    await Ledger.create({
      pharmacist: order.pharmacist,
      warehouse: req.user._id,
      order: order._id,
      type: 'payment',
      amount: totalRefundAmount,
      description: `مرتجع من الطلب #${order._id.toString().slice(-6)} - قيمة ${totalRefundAmount.toLocaleString()} ل.س`
    });
  }

  res.status(201).json({
    status: 'success',
    message: `تم تسجيل مرتجع بقيمة ${totalRefundAmount.toLocaleString()} ل.س وإعادة الأصناف للمخزن بنجاح`,
    data: { return: returnRecord, totalRefundAmount }
  });
});

// List all returns for the warehouse
exports.getReturns = catchAsync(async (req, res, next) => {
  const page  = Math.max(1, +req.query.page || 1);
  const limit = Math.min(100, +req.query.limit || 20);
  const skip  = (page - 1) * limit;

  const filter = { warehouse: req.user._id };

  const [returns, total] = await Promise.all([
    Return.find(filter)
      .sort('-createdAt')
      .skip(skip).limit(limit)
      .populate('originalOrder', 'createdAt source customerName')
      .populate('pharmacist', 'name pharmacyName')
      .populate('returnedDrugs.drug', 'name manufacturer')
      .lean(),
    Return.countDocuments(filter)
  ]);

  res.status(200).json({
    status: 'success',
    page, limit, total,
    results: returns.length,
    data: { returns }
  });
});

// Get single return
exports.getReturnById = catchAsync(async (req, res, next) => {
  const ret = await Return.findOne({ _id: req.params.id, warehouse: req.user._id })
    .populate('originalOrder', 'createdAt source customerName drugs')
    .populate('pharmacist', 'name pharmacyName phone')
    .populate('returnedDrugs.drug', 'name manufacturer');

  if (!ret) return next(new AppError('لا يوجد مرتجع بهذا المعرف', 404));
  res.status(200).json({ status: 'success', data: { return: ret } });
});
