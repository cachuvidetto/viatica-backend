const catchAsync = require('../utils/catchAsync');
const Supplier = require('../models/Supplier');

exports.getSuppliers = catchAsync(async (req, res) => {
  const suppliers = await Supplier.find({ warehouse: req.user._id }).sort('name').lean();
  res.status(200).json({ status: 'success', results: suppliers.length, data: { suppliers } });
});

exports.createSupplier = catchAsync(async (req, res) => {
  const supplier = await Supplier.create({ ...req.body, warehouse: req.user._id });
  res.status(201).json({ status: 'success', data: { supplier } });
});

exports.updateSupplier = catchAsync(async (req, res) => {
  const supplier = await Supplier.findOneAndUpdate(
    { _id: req.params.id, warehouse: req.user._id },
    req.body,
    { new: true, runValidators: true }
  );
  res.status(200).json({ status: 'success', data: { supplier } });
});

exports.deleteSupplier = catchAsync(async (req, res) => {
  await Supplier.findOneAndDelete({ _id: req.params.id, warehouse: req.user._id });
  res.status(204).json({ status: 'success', data: null });
});
