const catchAsync = require('../utils/catchAsync');
const Order = require('../models/Order');
const AppError = require('../utils/appError');
const mongoose = require('mongoose');

exports.getSalesReport = catchAsync(async (req, res, next) => {
  const isWarehouse = req.user.role === 'warehouse';
  const warehouseId = req.user._id;

  const { startDate, endDate, pharmacistId } = req.query;

  const filter = {};
  if (isWarehouse) {
    filter.warehouse = new mongoose.Types.ObjectId(warehouseId);
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) {
      filter.createdAt.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  if (pharmacistId && pharmacistId !== 'all' && mongoose.Types.ObjectId.isValid(pharmacistId)) {
    filter.pharmacist = new mongoose.Types.ObjectId(pharmacistId);
  }

  // 1. Get raw orders (sales) matching filter
  const orders = await Order.find(filter)
    .populate('pharmacist', 'name pharmacyName phone role')
    .sort('-createdAt')
    .lean();

  // 2. Aggregate Top Drugs in this period
  const topDrugsAgg = await Order.aggregate([
    { $match: filter },
    { $unwind: '$drugs' },
    {
      $group: {
        _id: '$drugs.drug',
        totalQty: { $sum: '$drugs.quantity' },
        totalRevenue: { $sum: { $multiply: ['$drugs.price', '$drugs.quantity'] } }
      }
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'drugs',
        localField: '_id',
        foreignField: '_id',
        as: 'drugDetails'
      }
    },
    { $unwind: '$drugDetails' },
    {
      $project: {
        _id: 1,
        totalQty: 1,
        totalRevenue: 1,
        name: '$drugDetails.name',
        manufacturer: '$drugDetails.manufacturer'
      }
    }
  ]);

  // Calculate totals
  let totalRevenue = 0;
  let totalOrdersCount = orders.length;

  const formattedOrders = orders.map(o => {
    const orderTotal = o.drugs.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    totalRevenue += orderTotal;

    return {
      _id: o._id,
      createdAt: o.createdAt,
      source: o.source,
      status: o.status,
      total: orderTotal,
      clientName: o.pharmacist ? (o.pharmacist.pharmacyName || o.pharmacist.name) : (o.customerName || 'مبيع مباشر غير مسجل'),
      clientPhone: o.pharmacist ? o.pharmacist.phone : (o.customerPhone || ''),
      itemsCount: o.drugs.length
    };
  });

  res.status(200).json({
    status: 'success',
    data: {
      summary: {
        totalRevenue,
        totalOrdersCount
      },
      topDrugs: topDrugsAgg,
      orders: formattedOrders
    }
  });
});
