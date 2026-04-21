const Invoice = require('../models/Invoice');
const Order   = require('../models/Order');
const User    = require('../models/User');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

// ─── Create Invoice from an Order ──────────────────────────────────────────
exports.generateInvoice = catchAsync(async (req, res, next) => {
  const { orderId, discount = 0, notes, paymentType = 'cash' } = req.body;

  const order = await Order.findById(orderId).populate('drugs.drug');
  if (!order) return next(new AppError('لا يوجد طلب بهذا المعرف', 404));

  // Only warehouse that owns the order can create invoice
  if (req.user.role === 'warehouse' && !order.warehouse.equals(req.user._id)) {
    return next(new AppError('ليس لديك صلاحية لإنشاء فاتورة لهذا الطلب', 403));
  }

  const warehouseId = order.warehouse;
  const warehouse   = await User.findById(warehouseId).select('name logo phone addressText managerName pharmacyName');

  // Build line items snapshot
  const items = order.drugs.map(d => ({
    drugName:     d.drug?.name     || 'صنف محذوف',
    manufacturer: d.drug?.manufacturer || '',
    quantity:     d.quantity,
    unitPrice:    d.price,
    total:        d.quantity * d.price
  }));

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const total    = subtotal - (discount || 0);

  const invoice = await Invoice.create({
    order: order._id,
    warehouse: warehouseId,
    warehouseSnapshot: {
      name:        warehouse?.pharmacyName || warehouse?.name || 'المستودع',
      logo:        warehouse?.logo || '',
      phone:       warehouse?.phone || '',
      address:     warehouse?.addressText || '',
      managerName: warehouse?.managerName || '',
      invoiceFooterText: warehouse?.invoiceFooterText || ''
    },
    customerName:  order.customerName || '',
    customerPhone: order.customerPhone || '',
    items,
    subtotal,
    discount:    discount || 0,
    total,
    paymentType,
    notes,
    status: 'issued'
  });

  res.status(201).json({ status: 'success', data: { invoice } });
});

// ─── Create Invoice Directly (from POS without needing orderId separately) ─
exports.createDirectInvoice = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'warehouse') return next(new AppError('غير مصرح', 403));

  const { items, customerName, customerPhone, discount = 0, notes, paymentType = 'cash', orderId } = req.body;
  if (!items || !items.length) return next(new AppError('لا توجد أصناف في الفاتورة', 400));

  const warehouse = await User.findById(req.user._id).select('name logo phone addressText managerName pharmacyName');

  const subtotal = items.reduce((s, i) => s + (i.unitPrice * i.quantity), 0);
  const total    = subtotal - discount;

  const invoice = await Invoice.create({
    order: orderId || undefined,
    warehouse: req.user._id,
    warehouseSnapshot: {
      name:        warehouse?.pharmacyName || warehouse?.name || 'المستودع',
      logo:        warehouse?.logo || '',
      phone:       warehouse?.phone || '',
      address:     warehouse?.addressText || '',
      managerName: warehouse?.managerName || '',
      invoiceFooterText: warehouse?.invoiceFooterText || ''
    },
    customerName,
    customerPhone,
    items: items.map(i => ({ ...i, total: i.unitPrice * i.quantity })),
    subtotal,
    discount,
    total,
    paymentType,
    notes,
    status: 'issued'
  });

  res.status(201).json({ status: 'success', data: { invoice } });
});

// ─── Get All Invoices ───────────────────────────────────────────────────────
exports.getAllInvoices = catchAsync(async (req, res, next) => {
  const filter = {};
  if (req.user.role === 'warehouse') filter.warehouse = req.user._id;

  const page  = Math.max(1, +req.query.page  || 1);
  const limit = Math.min(100, +req.query.limit || 20);
  const skip  = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    Invoice.find(filter).sort('-createdAt').skip(skip).limit(limit).lean(),
    Invoice.countDocuments(filter)
  ]);

  res.status(200).json({ status: 'success', page, limit, total, results: invoices.length, data: { invoices } });
});

// ─── Get Single Invoice (for print) ────────────────────────────────────────
exports.getInvoiceById = catchAsync(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id).lean();
  if (!invoice) return next(new AppError('لا توجد فاتورة بهذا المعرف', 404));
  res.status(200).json({ status: 'success', data: { invoice } });
});
