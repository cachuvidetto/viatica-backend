const Ledger = require('../models/Ledger');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');

// 1. Get Accounts Balances (For Warehouse)
exports.getAccountsBalances = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'warehouse' && req.user.role !== 'admin') {
    return next(new AppError('غير مصرح لك بمشاهدة الحسابات', 403));
  }

  const warehouseId = req.user.role === 'warehouse' ? req.user._id : req.query.warehouse;

  // Aggregate over the ledger to get the current balance per pharmacist
  const balances = await Ledger.aggregate([
    { $match: { warehouse: new mongoose.Types.ObjectId(warehouseId) } },
    {
      $group: {
        _id: '$pharmacist',
        totalDebt: {
          $sum: { $cond: [{ $eq: ['$type', 'debt'] }, '$amount', 0] }
        },
        totalPayments: {
          $sum: { $cond: [{ $eq: ['$type', 'payment'] }, '$amount', 0] }
        }
      }
    },
    {
      $project: {
        pharmacist: '$_id',
        totalDebt: 1,
        totalPayments: 1,
        currentBalance: { $subtract: ['$totalDebt', '$totalPayments'] }
      }
    },
    // We want to show all pharmacists that have any transaction logs, 
    // even if their balance is 0, so they can see past statements.
    {
      $lookup: {
        from: 'users',
        localField: 'pharmacist',
        foreignField: '_id',
        as: 'pharmacistDetails'
      }
    },
    { $unwind: '$pharmacistDetails' },
    {
      $project: {
        _id: 1,
        totalDebt: 1,
        totalPayments: 1,
        currentBalance: 1,
        "pharmacistName": "$pharmacistDetails.name",
        "pharmacistPhone": "$pharmacistDetails.phone",
        "pharmacyName": "$pharmacistDetails.pharmacyName"
      }
    }
  ]);

  res.status(200).json({ status: 'success', data: { balances } });
});

// 2. Add Payment (Receipt Voucher)
exports.addPayment = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'warehouse') return next(new AppError('فقط المستودع يمكنه تسجيل الدفعات', 403));

  const { pharmacistId, amount, description } = req.body;

  if (!pharmacistId || !amount || amount <= 0) {
    return next(new AppError('بيانات الدفعة غير مكتملة أو غير صالحة', 400));
  }

  const paymentEntry = await Ledger.create({
    warehouse: req.user._id,
    pharmacist: pharmacistId,
    type: 'payment',
    amount: amount,
    description: description || 'تسديد دفعة نقدية من الحساب'
  });

  res.status(201).json({ status: 'success', message: 'تم تسجيل الدفعة وتحديث الرصيد', data: { payment: paymentEntry } });
});

// 3. Get Specific Pharmacist Account Statement
exports.getAccountStatement = catchAsync(async (req, res, next) => {
  const warehouseId = req.user.role === 'warehouse' ? req.user._id : req.query.warehouse;
  const pharmacistId = req.params.pharmacistId;

  const logs = await Ledger.find({ warehouse: warehouseId, pharmacist: pharmacistId })
    .populate('order', 'createdAt')
    .sort('transactionDate');

  let runningBalance = 0;
  const statement = logs.map(log => {
      if (log.type === 'debt') runningBalance += log.amount;
      else if (log.type === 'payment') runningBalance -= log.amount;

      return {
          id: log._id,
          date: log.transactionDate,
          type: log.type,
          amount: log.amount,
          description: log.description,
          orderId: log.order ? log.order._id : null,
          runningBalance: runningBalance
      };
  });

  res.status(200).json({ status: 'success', data: { statement, finalBalance: runningBalance } });
});
