const StockMovement = require('../models/StockMovement');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getStockMovements = catchAsync(async (req, res, next) => {
  const page = Math.max(1, +req.query.page || 1);
  const limit = Math.min(200, +req.query.limit || 30);
  const skip = (page - 1) * limit;

  // By default: warehouse sees own, pharmacist sees own (as stock owner)
  const filter = {};
  if (req.user.role === 'warehouse' || req.user.role === 'pharmacist') {
    filter.warehouse = req.user._id;
  } else if (req.user.role === 'admin') {
    if (req.query.warehouse) filter.warehouse = req.query.warehouse;
  } else {
    return next(new AppError('غير مصرح', 403));
  }

  if (req.query.drug) filter.drug = req.query.drug;
  if (req.query.type) filter.type = req.query.type;
  if (req.query.referenceModel) filter.referenceModel = req.query.referenceModel;
  if (req.query.referenceId) filter.referenceId = req.query.referenceId;
  if (req.query.actor) filter.actor = req.query.actor;

  if (req.query.startDate || req.query.endDate) {
    filter.createdAt = {};
    if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
    if (req.query.endDate) filter.createdAt.$lte = new Date(req.query.endDate + 'T23:59:59');
  }

  const [movements, total] = await Promise.all([
    StockMovement.find(filter)
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate('drug', 'name manufacturer barcode')
      .populate('actor', 'name role')
      .lean(),
    StockMovement.countDocuments(filter)
  ]);

  res.status(200).json({
    status: 'success',
    page,
    limit,
    total,
    results: movements.length,
    data: { movements }
  });
});

