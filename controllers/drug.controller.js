const Drug = require('../models/Drug');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const AIService = require('../services/ai.service');

exports.getAllDrugs = catchAsync(async (req, res, next) => {
  const { category, warehouse, expiresSoon, search } = req.query;
  
  let query = {};

  // 🔐 Core Security: Warehouse users ONLY see their own drugs
  if (req.user.role === 'warehouse') {
    query.warehouse = req.user._id;
  } else if (warehouse) {
    // Admin or pharmacist can filter by specific warehouse
    query.warehouse = warehouse;
  }

  if (category) query.category = category;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { genericName: { $regex: search, $options: 'i' } },
      { activeIngredients: { $regex: search, $options: 'i' } }
    ];
  }
  if (expiresSoon === 'true') {
    query.expiryDate = { 
      $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
  }

  const drugs = await Drug.find(query).populate('warehouse', 'name email phone pharmacyName');
  
  res.status(200).json({
    status: 'success',
    results: drugs.length,
    data: { drugs }
  });
});

exports.createDrug = catchAsync(async (req, res, next) => {
  // Admin can specify warehouse, otherwise use logged-in user
  const warehouseId = (req.user.role === 'admin' && req.body.warehouse)
    ? req.body.warehouse 
    : req.user.id;

  const drug = await Drug.create({
    ...req.body,
    warehouse: warehouseId
  });

  await AIService.analyzeDrugData(drug);

  res.status(201).json({
    status: 'success',
    data: { drug }
  });
});

exports.getDrugById = catchAsync(async (req, res, next) => {
  const drug = await Drug.findById(req.params.id).populate('warehouse', 'name email phone pharmacyName');
  
  if (!drug) {
    return next(new AppError('No drug found with that ID', 404));
  }

  // 🔐 Warehouse can only view their own drugs
  if (req.user.role === 'warehouse' && String(drug.warehouse._id || drug.warehouse) !== String(req.user._id)) {
    return next(new AppError('لا تملك صلاحية للوصول لهذا الدواء', 403));
  }

  res.status(200).json({
    status: 'success',
    data: { drug }
  });
});

exports.updateDrug = catchAsync(async (req, res, next) => {
  // 🔐 First find the drug to check ownership
  const existingDrug = await Drug.findById(req.params.id);
  if (!existingDrug) {
    return next(new AppError('No drug found with that ID', 404));
  }

  // Warehouse can only update their own drugs
  if (req.user.role === 'warehouse') {
    const drugOwnerId = existingDrug.warehouse ? String(existingDrug.warehouse._id || existingDrug.warehouse) : null;
    if (drugOwnerId && drugOwnerId !== String(req.user._id)) {
      return next(new AppError('لا تملك صلاحية لتعديل هذا الدواء', 403));
    }
  }

  // Prevent warehouse from changing the warehouse field
  if (req.user.role === 'warehouse') {
    delete req.body.warehouse;
  }

  const drug = await Drug.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    data: { drug }
  });
});

exports.deleteDrug = catchAsync(async (req, res, next) => {
  // 🔐 First find the drug to check ownership
  const drug = await Drug.findById(req.params.id);
  if (!drug) {
    return next(new AppError('No drug found with that ID', 404));
  }

  // Warehouse can only delete their own drugs
  if (req.user.role === 'warehouse' && String(drug.warehouse) !== String(req.user._id)) {
    return next(new AppError('لا تملك صلاحية لحذف هذا الدواء', 403));
  }

  await Drug.findByIdAndDelete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null
  });
});