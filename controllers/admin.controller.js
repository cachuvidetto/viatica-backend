const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const User = require('../models/User');
const Order = require('../models/Order');
const Drug = require('../models/Drug');
const Invoice = require('../models/Invoice');
const Ledger = require('../models/Ledger');
const mongoose = require('mongoose');

exports.getDashboardStats = catchAsync(async (req, res, next) => {
  const isWarehouse = req.user.role === 'warehouse';
  const warehouseId = req.user._id;

  const orderFilter = isWarehouse ? { warehouse: warehouseId } : {};
  const drugFilter  = isWarehouse ? { warehouse: warehouseId } : {};

  // ─── Basic Counts ───
  const [totalOrders, totalDrugs, lowStock, pendingOrders] = await Promise.all([
    Order.countDocuments(orderFilter),
    Drug.countDocuments(drugFilter),
    Drug.countDocuments({ ...drugFilter, quantity: { $lt: 10 } }),
    Order.countDocuments({ ...orderFilter, status: 'pending' })
  ]);

  // ─── Recent Orders ───
  const recentOrders = await Order.find(orderFilter)
    .sort('-createdAt')
    .limit(8)
    .populate('pharmacist', 'name pharmacyName')
    .lean();

  // ─── Sales This Month ───
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);

  const salesAgg = await Order.aggregate([
    { $match: { ...orderFilter, ...(isWarehouse ? { warehouse: new mongoose.Types.ObjectId(warehouseId) } : {}), createdAt: { $gt: monthAgo } } },
    { $unwind: '$drugs' },
    { $group: { _id: null, total: { $sum: { $multiply: ['$drugs.price', '$drugs.quantity'] } } } }
  ]);
  const totalSalesMonth = salesAgg[0]?.total || 0;

  // ─── Sales Today ───
  const salesTodayAgg = await Order.aggregate([
    { $match: { ...orderFilter, ...(isWarehouse ? { warehouse: new mongoose.Types.ObjectId(warehouseId) } : {}), createdAt: { $gte: todayStart } } },
    { $unwind: '$drugs' },
    { $group: { _id: null, total: { $sum: { $multiply: ['$drugs.price', '$drugs.quantity'] } } } }
  ]);
  const totalSalesToday = salesTodayAgg[0]?.total || 0;

  // ─── Invoices Today ───
  const invoicesToday = await Invoice.countDocuments({
    ...(isWarehouse ? { warehouse: warehouseId } : {}),
    createdAt: { $gte: todayStart }
  });

  // ─── Daily Sales for Chart (Last 7 Days) ───
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const dailySales = await Order.aggregate([
    { $match: { ...orderFilter, ...(isWarehouse ? { warehouse: new mongoose.Types.ObjectId(warehouseId) } : {}), createdAt: { $gte: sevenDaysAgo } } },
    { $unwind: '$drugs' },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        total: { $sum: { $multiply: ['$drugs.price', '$drugs.quantity'] } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // Fill missing days
  const chartData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().split('T')[0];
    const found = dailySales.find(s => s._id === key);
    chartData.push({
      date: key,
      label: d.toLocaleDateString('ar-SY', { weekday: 'short' }),
      total: found?.total || 0,
      count: found?.count || 0
    });
  }

  // ─── Top Selling Drugs (Last 30 Days) ───
  const topDrugs = await Order.aggregate([
    { $match: { ...orderFilter, ...(isWarehouse ? { warehouse: new mongoose.Types.ObjectId(warehouseId) } : {}), createdAt: { $gt: monthAgo } } },
    { $unwind: '$drugs' },
    {
      $group: {
        _id: '$drugs.drug',
        totalQty: { $sum: '$drugs.quantity' },
        totalRevenue: { $sum: { $multiply: ['$drugs.price', '$drugs.quantity'] } }
      }
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'drugs',
        localField: '_id',
        foreignField: '_id',
        as: 'drugInfo'
      }
    },
    { $unwind: { path: '$drugInfo', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        name: { $ifNull: ['$drugInfo.name', 'صنف محذوف'] },
        manufacturer: '$drugInfo.manufacturer',
        totalQty: 1,
        totalRevenue: 1
      }
    }
  ]);

  // ─── Outstanding Debts ───
  let outstandingDebts = 0;
  if (isWarehouse) {
    const debtAgg = await Ledger.aggregate([
      { $match: { warehouse: new mongoose.Types.ObjectId(warehouseId) } },
      {
        $group: {
          _id: null,
          totalDebt: { $sum: { $cond: [{ $eq: ['$type', 'debt'] }, '$amount', 0] } },
          totalPaid: { $sum: { $cond: [{ $eq: ['$type', 'payment'] }, '$amount', 0] } }
        }
      }
    ]);
    outstandingDebts = debtAgg[0] ? (debtAgg[0].totalDebt - debtAgg[0].totalPaid) : 0;
  }

  res.status(200).json({
    status: 'success',
    data: {
      totalOrders,
      totalDrugs,
      lowStock,
      pendingOrders,
      totalSalesMonth,
      totalSalesToday,
      invoicesToday,
      outstandingDebts,
      chartData,
      topDrugs,
      recentOrders,
      role: req.user.role
    }
  });
});