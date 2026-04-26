const mongoose = require('mongoose');
const Order = require('../models/Order');
const Drug = require('../models/Drug');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const notificationController = require('../controllers/notification.controller');
const User = require('../models/User'); 
const PharmacistStock = require('../models/PharmacistStock');
const Ledger = require('../models/Ledger');
const Invoice = require('../models/Invoice');

const buildScope = (user) => {
  const filter = {};
  if (user.role === 'pharmacist') filter.pharmacist = user._id;
  if (user.role === 'warehouse')  filter.warehouse  = user._id;
  if (user.role === 'driver')     filter.driver     = user._id;
  return filter;
};

exports.getAllOrders = catchAsync(async (req, res, next) => {
  const page  = Math.max(1, +req.query.page || 1);
  const limit = Math.min(100, +req.query.limit || 20);
  const skip  = (page - 1) * limit;
  const filter = buildScope(req.user);

  // Support filtering by status (e.g., status=delivered for Returns page)
  if (req.query.status) {
    filter.status = req.query.status;
  }

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort('-createdAt')
      .skip(skip).limit(limit)
      .select('pharmacist warehouse driver status createdAt drugs source customerName customerPhone')
      .populate('pharmacist', 'name pharmacyName role')
      .populate('warehouse driver', 'name role')
      .populate('drugs.drug', 'name manufacturer')
      .lean(),
    Order.countDocuments(filter)
  ]);

  res.status(200).json({ status: 'success', page, limit, total, results: orders.length, data: { orders } });
});


exports.getOrderById = catchAsync(async (req, res, next) => {
  const filter = { _id: req.params.id, ...buildScope(req.user) };
  const order = await Order.findOne(filter)
    .populate('pharmacist warehouse driver', 'name role')
    .populate('drugs.drug');
  if (!order) return next(new AppError('لا يوجد طلب بهذا المعرف أو لا تملك صلاحية الوصول', 404));
  res.status(200).json({ status: 'success', data: { order } });
});

exports.createOrder = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'pharmacist') return next(new AppError('الصيدلي فقط يمكنه إنشاء الطلب', 403));
  const { warehouse, drugs, deliveryAddress } = req.body;

  // 1. Fetch Active Offers for this Warehouse
  const Offer = require('../models/Offer');
  const activeOffers = await Offer.find({
    warehouse,
    isActive: true,
    endDate: { $gte: new Date() }
  });

  const finalDrugsList = [];
  let totalOrderValue = 0;

  // 2. Process items and apply business logic
  for (const item of drugs) {
    const drugDoc = await Drug.findById(item.drug);
    if (!drugDoc) throw new AppError('أحد الأدوية المطلوبة غير موجود', 400);

    // Find matching offer for this drug
    const offer = activeOffers.find(o => o.drug && String(o.drug) === String(item.drug));
    
    let unitPrice = drugDoc.price;
    let bonusItems = 0;

    if (offer) {
      // Apply % Discount
      if (offer.type === 'discount' && offer.discountPercentage) {
        unitPrice = unitPrice * (1 - offer.discountPercentage / 100);
      }
      
      // Calculate Bonus (10 + 2)
      if (offer.type === 'bonus' && offer.bonusBase && offer.bonusQuantity) {
        bonusItems = Math.floor(item.quantity / offer.bonusBase) * offer.bonusQuantity;
      }
    }

    const totalQuantityToDeduct = item.quantity + bonusItems;

    // Check & Deduct Stock
    const updated = await Drug.findOneAndUpdate(
      { _id: item.drug, warehouse, quantity: { $gte: totalQuantityToDeduct } },
      { $inc: { quantity: -totalQuantityToDeduct } },
      { new: true }
    );
    if (!updated) throw new AppError(`كمية غير كافية للدواء ${drugDoc.name}`, 400);

    // Add main item
    finalDrugsList.push({
      drug: item.drug,
      quantity: item.quantity,
      price: unitPrice,
      costPrice: drugDoc.costPrice || 0,
      appliedOffer: offer ? offer._id : undefined
    });

    if (bonusItems > 0) {
      finalDrugsList.push({
        drug: item.drug,
        quantity: bonusItems,
        price: 0,
        costPrice: drugDoc.costPrice || 0,
        isBonus: true,
        appliedOffer: offer ? offer._id : undefined
      });
    }

    totalOrderValue += (unitPrice * item.quantity);
  }

  // 3. Check for Free Delivery Offers
  let isFreeDelivery = false;
  const deliveryOffer = activeOffers.find(o => o.freeDelivery && totalOrderValue >= o.minOrderValue);
  if (deliveryOffer) {
    isFreeDelivery = true;
  }

  const order = await Order.create({
    pharmacist: req.user._id,
    warehouse,
    drugs: finalDrugsList,
    deliveryAddress,
    isFreeDelivery,
    deliveryFee: isFreeDelivery ? 0 : 5000 // Default delivery fee if not free
  });

  res.status(201).json({ 
    status: 'success', 
    message: 'تم إنشاء الطلب وتطبيق العروض المتاحة تلقائياً', 
    data: { order } 
  });

  // Notify Admin + Warehouse
  try {
    const admins = await User.find({ role: 'admin' });
    for (const admin of admins) {
      await notificationController.createNotification(
        admin._id, 
        'طلب شراء جديد', 
        `قام الصيدلاني ${req.user.name} بإنشاء طلب شراء جديد بقيمة إجمالية.`
      );
    }
    // Notify the warehouse
    await notificationController.createNotification(
      warehouse,
      'طلب وارد جديد 📦',
      `لديك طلب جديد من الصيدلاني "${req.user.name}". راجع تفاصيل الطلب وقم بالموافقة أو الرفض.`
    );
  } catch (err) {
    console.error('Notification error:', err);
  }
});

exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) return next(new AppError('لا يوجد طلب بهذا المعرف', 404));

  if (req.user.role === 'admin') {
     return next(new AppError('المدير ليس لديه صلاحية لتعيين السائقين، المستودع فقط هو المسؤول', 403));
  } else if (req.user.role === 'warehouse' && String(order.warehouse) !== String(req.user._id)) {
     return next(new AppError('هذا الطلب غير تابع لمستودعك', 403));
  }
  // Authorization
  if (req.user.role === 'admin') {
    return next(new AppError('المدير ليس لديه صلاحية لمعالجة الطلبات، المستودع فقط هو المسؤول', 403));
  } else if (req.user.role === 'warehouse') {
    if (String(order.warehouse) !== String(req.user._id)) {
      return next(new AppError('هذا الطلب غير تابع لمستودعك', 403));
    }
  } else if (req.user.role === 'driver') {
    const driverAllowed = ['out_for_delivery','delivered'];
    if (!driverAllowed.includes(status)) return next(new AppError('السائق لا يملك صلاحية لتحديث هذه الحالة', 403));
    if (String(order.driver) !== String(req.user._id)) return next(new AppError('طلب غير مسند لهذا السائق', 403));
  } else if (req.user.role === 'pharmacist') {
    if (status !== 'delivered') return next(new AppError('الصيدلاني يملك صلاحية فقط لتأكيد الاستلام', 403));
    if (String(order.pharmacist) !== String(req.user._id)) return next(new AppError('هذا الطلب غير مسجل باسمك', 403));
  } else {
    return next(new AppError('ليست لديك صلاحية لتحديث الطلب', 403));
  }

  // Validation: Cannot move to 'assigned' or 'out_for_delivery' without a driver
  if ((status === 'assigned' || status === 'out_for_delivery') && !order.driver) {
     return next(new AppError('لا يمكن تغيير الحالة قبل تعيين سائق للطلب', 400));
  }

  order.status = status;
  await order.save();

  // 1. Notify Pharmacist about status change
  try {
    let title = 'تحديث حالة الطلب';
    let message = `حالة طلبك رقم #${order._id.toString().slice(-6)} أصبحت الآن: ${status}`;
    
    if (status === 'confirmed') message = `تم تأكيد طلبك رقم #${order._id.toString().slice(-6)}. جاري التجهيز.`;
    if (status === 'out_for_delivery') message = `طلبك رقم #${order._id.toString().slice(-6)} في الطريق إليك الآن.`;
    if (status === 'delivered') message = `تم تسليم طلبك رقم #${order._id.toString().slice(-6)} بنجاح. شكراً لتعاملك معنا!`;
    if (status === 'cancelled') message = `تم إلغاء طلبك رقم #${order._id.toString().slice(-6)}. يرجى التواصل مع الإدارة.`;

    await notificationController.createNotification(order.pharmacist, title, message);
  } catch (notifyErr) {
    console.error('Error sending status notification:', notifyErr);
  }

  // Unified Order Closure Logic (Inventory + Ledger)
  if (status === 'delivered') {
    try {
      // 1. Sync Inventory (PharmacistStock)
      for (const item of order.drugs) {
        await PharmacistStock.findOneAndUpdate(
          { pharmacist: order.pharmacist, drug: item.drug },
          { 
            $inc: { quantity: item.quantity },
            // Batch/Expiry info would ideally come from the warehouse delivery system
            // For now we use placeholder or last known
          },
          { upsert: true, new: true }
        );
      }

      // 2. Sync Ledger (Financial Debt)
      // Calculate total order value (Price * Quantity for all items)
      const totalAmount = order.drugs.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      await Ledger.create({
        pharmacist: order.pharmacist,
        warehouse: order.warehouse,
        order: order._id,
        type: 'debt',
        amount: totalAmount,
        description: `فاتورة طلب رقم #${order._id.toString().slice(-6)}`
      });

      console.log(`Order ${order._id} closed: Inventory & Ledger updated.`);
    } catch (syncError) {
      console.error('Error in Order Closure Sync:', syncError);
      // In a production app, we might want to log this to a separate error queue for retry
    }
  }

  res.status(200).json({ status: 'success', data: { order } });
});

exports.assignDriver = catchAsync(async (req, res, next) => {
  if (!['warehouse','admin'].includes(req.user.role)) return next(new AppError('غير مصرح', 403));
  const { driverId } = req.body;
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, warehouse: req.user.role === 'warehouse' ? req.user._id : { $exists: true } },
    { driver: driverId, status: 'assigned' },
    { new: true }
  ).populate('driver', 'name role');
  if (!order) return next(new AppError('لا يوجد طلب أو لا تملك صلاحية', 404));
  res.status(200).json({ status: 'success', data: { order } });
});

// ═══════════════════════════════════════════════════
// Manual Sale (POS) — Warehouse creates sale directly
// ═══════════════════════════════════════════════════
exports.createManualSale = catchAsync(async (req, res, next) => {
  if (req.user.role !== 'warehouse') return next(new AppError('فقط المستودع يمكنه إنشاء عملية بيع', 403));

  const { drugs, source, customerName, customerPhone, pharmacistId, notes, paymentType } = req.body;

  if (!drugs || !drugs.length) return next(new AppError('يجب إضافة صنف واحد على الأقل', 400));
  if (!source) return next(new AppError('يجب تحديد نوع البيع', 400));

  const finalDrugsList = [];
  let totalAmount = 0;

  // Process each drug — verify stock and deduct
  for (const item of drugs) {
    const drugDoc = await Drug.findById(item.drug);
    if (!drugDoc) return next(new AppError(`الصنف غير موجود في قاعدة البيانات`, 400));

    // Verify stock
    const updated = await Drug.findOneAndUpdate(
      { _id: item.drug, warehouse: req.user._id, quantity: { $gte: item.quantity } },
      { $inc: { quantity: -item.quantity } },
      { new: true }
    );
    if (!updated) return next(new AppError(`الكمية غير كافية للصنف: ${drugDoc.name}`, 400));

    const unitPrice = item.price || drugDoc.price;
    finalDrugsList.push({
      drug: item.drug,
      quantity: item.quantity,
      price: unitPrice,
      costPrice: drugDoc.costPrice || 0
    });
    totalAmount += unitPrice * item.quantity;
  }

  // Create the order (auto-confirmed for manual sales)
  const orderData = {
    warehouse: req.user._id,
    drugs: finalDrugsList,
    status: paymentType === 'cash' ? 'delivered' : 'confirmed', // Cash = instant close
    source: source,
    customerName: customerName || '',
    customerPhone: customerPhone || '',
    notes: notes || ''
  };

  // If selling to a registered pharmacist
  if (pharmacistId) {
    orderData.pharmacist = pharmacistId;
  }

  const order = await Order.create(orderData);

  // Financial: Record in Ledger for registered pharmacists/customers
  if (pharmacistId) {
    try {
      // Always record the debt (Invoice generation)
      await Ledger.create({
        pharmacist: pharmacistId,
        warehouse: req.user._id,
        order: order._id,
        type: 'debt',
        amount: totalAmount,
        description: paymentType === 'cash' ? `فاتورة بيع نقدي #${order._id.toString().slice(-6)}` : `فاتورة بيع آجل #${order._id.toString().slice(-6)}`
      });

      // If it's a cash sale, instantly record the settlement payment
      if (paymentType === 'cash') {
        await Ledger.create({
          pharmacist: pharmacistId,
          warehouse: req.user._id,
          order: order._id,
          type: 'payment',
          amount: totalAmount,
          description: `تسديد نقدي فوري للفاتورة #${order._id.toString().slice(-6)}`
        });
      }
    } catch (err) {
      console.error('Ledger entry error:', err);
    }
  }

  // Create Invoice Snapshot
  let invoice = null;
  try {
    const warehouse = await User.findById(req.user._id).select('name logo phone addressText managerName pharmacyName');
    const invoiceItems = [];
    
    // We already have finalDrugsList but we need drug names
    for (const item of finalDrugsList) {
      const d = await Drug.findById(item.drug).select('name manufacturer');
      invoiceItems.push({
        drugName: d?.name || 'صنف محذوف',
        manufacturer: d?.manufacturer || '',
        quantity: item.quantity,
        unitPrice: item.price,
        total: item.price * item.quantity
      });
    }

    invoice = await Invoice.create({
      order: order._id,
      warehouse: req.user._id,
      warehouseSnapshot: {
        name:        warehouse?.pharmacyName || warehouse?.name || 'المستودع',
        logo:        warehouse?.logo || '',
        phone:       warehouse?.phone || '',
        address:     warehouse?.addressText || '',
        managerName: warehouse?.managerName || '',
        invoiceFooterText: warehouse?.invoiceFooterText || ''
      },
      customerName:  customerName || (pharmacistId ? 'صيدلية مسجلة' : ''),
      customerPhone: customerPhone || '',
      items: invoiceItems,
      subtotal: totalAmount,
      discount: 0,
      total: totalAmount,
      paymentType,
      notes,
      status: 'issued'
    });
  } catch (err) {
    console.error('Invoice creation error:', err);
  }

  res.status(201).json({
    status: 'success',
    message: paymentType === 'cash' ? 'تم تثبيت البيع النقدي بنجاح' : 'تم تثبيت البيع الآجل وتسجيله في الحسابات',
    data: { order, totalAmount, invoiceId: invoice ? invoice._id : null }
  });
});
