const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Drug = require('../models/Drug');
const Order = require('../models/Order');
const auth = require('../middlewares/auth');
const upload = require('../middlewares/upload');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const notificationController = require('../controllers/notification.controller');

// Helper to notify admin
const notifyAdmin = async (title, message) => {
  const admins = await User.find({ role: 'admin' });
  for (const admin of admins) {
    await notificationController.createNotification(admin._id, title, message);
  }
};

// Update current user profile
router.patch('/updateMe', auth.protect, upload.fields([{ name: 'licenseImage', maxCount: 1 }, { name: 'logo', maxCount: 1 }]), catchAsync(async (req, res, next) => {
  // 1) Filter allowed fields
  const { name, pharmacyName, lat, lng, invoiceFooter } = req.body;
  const updateData = {};
  if (name) updateData.name = name;
  if (pharmacyName) updateData.pharmacyName = pharmacyName;
  if (invoiceFooter !== undefined) updateData.invoiceFooter = invoiceFooter;

  if (req.files && req.files.licenseImage) {
    updateData.licenseImage = req.files.licenseImage[0].path; // Cloudinary URL
  }
  if (req.files && req.files.logo) {
    updateData.logo = req.files.logo[0].path; // Cloudinary URL
  }

  if (lat && lng) {
    updateData.location = {
      type: 'Point',
      coordinates: [parseFloat(lng), parseFloat(lat)]
    };
  }

  // 2) Update user
  const user = await User.findByIdAndUpdate(req.user.id, updateData, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: { user }
  });

  // Notify Admin if license image was uploaded
  if (req.file) {
    notifyAdmin('طلب انضمام جديد', `قام صيدلاني جديد (${user.name}) برفع ترخيص الصيدلية وينتظر التفعيل.`);
  }
}));

// Get all verified warehouses for mobile app users
router.get('/public/warehouses', auth.protect, catchAsync(async (req, res, next) => {
  const warehouses = await User.find({ role: 'warehouse', status: 'verified' })
    .select('name pharmacyName logo phone addressText email')
    .sort('-createdAt');
    
  res.status(200).json({
    status: 'success',
    results: warehouses.length,
    data: { warehouses }
  });
}));

router.get('/', auth.protect, auth.restrictTo('admin', 'warehouse'), catchAsync(async (req, res) => {
  const { role } = req.query;
  const page  = Math.max(1, +req.query.page || 1);
  const limit = Math.min(100, +req.query.limit || 20);
  const skip  = (page - 1) * limit;

  const filter = {};
  if (role) filter.role = role;
  // Warehouse can only see pharmacists and customers
  if (req.user.role === 'warehouse') {
    filter.role = { $in: ['pharmacist', 'customer'] };
  }

  const [users, total] = await Promise.all([
    User.find(filter).select('-password').sort('-createdAt').skip(skip).limit(limit).lean(),
    User.countDocuments(filter)
  ]);
  res.status(200).json({ status: 'success', page, limit, total, results: users.length, data: { users } });
}));

// Quick-create a customer or pharmacist from warehouse POS
router.post('/', auth.protect, auth.restrictTo('admin', 'warehouse'), catchAsync(async (req, res, next) => {
  const { name, phone, pharmacyName, role } = req.body;
  if (!name || !phone) return next(new AppError('الاسم ورقم الهاتف مطلوبان', 400));

  let finalRole = role || 'pharmacist';
  if (req.user.role === 'warehouse' && !['pharmacist', 'customer'].includes(finalRole)) {
    finalRole = 'pharmacist'; // fallback safety
  }
  
  const user = await User.create({
    name, phone,
    pharmacyName: pharmacyName || name,
    role: finalRole,
    password: 'Viatica2024!',
    isVerified: true,
    status: 'verified'
  });

  res.status(201).json({
    status: 'success',
    data: { user: { _id: user._id, name: user.name, phone: user.phone, pharmacyName: user.pharmacyName, role: user.role } }
  });
}));

router.get('/warehouse/:id', auth.protect, auth.restrictTo('admin', 'warehouse'), catchAsync(async (req, res, next) => {
  // Security: If user is warehouse, they can only view their own profile
  if (req.user.role === 'warehouse' && String(req.user._id) !== req.params.id) {
    return next(new AppError('لا تملك صلاحية للوصول لبيانات هذا المستودع', 403));
  }

  const user = await User.findOne({ _id: req.params.id, role: 'warehouse' }).select('-password');
  if (!user) return next(new AppError('لم يتم العثور على المستودع', 404));

  const [totalDrugs, totalOrders, pendingOrders] = await Promise.all([
    Drug.countDocuments({ warehouse: user._id }),
    Order.countDocuments({ warehouse: user._id }),
    Order.countDocuments({ warehouse: user._id, status: 'pending' })
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      user,
      stats: { totalDrugs, totalOrders, pendingOrders }
    }
  });
}));

router.get('/:id', auth.protect, auth.restrictTo('admin'), catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id).select('-password');
  if (!user) return next(new AppError('لا يوجد مستخدم', 404));
  res.status(200).json({ status: 'success', data: { user } });
}));

router.patch('/:id', auth.protect, auth.restrictTo('admin', 'warehouse'), catchAsync(async (req, res, next) => {
  // Security: A warehouse can only update their own profile
  if (req.user.role === 'warehouse' && String(req.user._id) !== req.params.id) {
    return next(new AppError('لا تملك صلاحية لتحديث بيانات هذا المستخدم', 403));
  }

  const allowedFields = ['name', 'phone', 'email', 'managerName', 'commercialRegister', 'warehouseType', 'addressText', 'invoiceFooterText'];
  
  const updateData = {};
  allowedFields.forEach(field => {
    if (req.body[field] !== undefined) updateData[field] = req.body[field];
  });

  if (Object.keys(updateData).length === 0) {
    return next(new AppError('لا توجد حقول صالحة للتحديث', 400));
  }

  const user = await User.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true
  }).select('-password');

  if (!user) return next(new AppError('لا يوجد مستخدم', 404));

  res.status(200).json({ status: 'success', data: { user } });
}));

router.patch('/:id/status', auth.protect, auth.restrictTo('admin'), catchAsync(async (req, res, next) => {
  const { status } = req.body;
  if (!['pending_review', 'verified', 'rejected', 'suspended'].includes(status)) {
    return next(new AppError('حالة غير صالحة', 400));
  }

  const user = await User.findByIdAndUpdate(req.params.id, { 
    status,
    isVerified: status === 'verified'
  }, {
    new: true,
    runValidators: true
  });

  if (!user) return next(new AppError('لا يوجد مستخدم', 404));

  res.status(200).json({
    status: 'success',
    data: { user }
  });

  // Notify User about verification/rejection
  try {
    if (status === 'verified') {
      await notificationController.createNotification(user._id, 'تم تفعيل حسابك', 'تم مراجعة بياناتك وتفعيل حسابك بنجاح. يمكنك الآن البدء بطلب الأدوية واستخدام كافة ميزات فارمجي.');
    } else if (status === 'rejected') {
      await notificationController.createNotification(user._id, 'فشل تفعيل الحساب', 'نعتذر، لم يتم قبول طلب تفعيل حسابك. يرجى التأكد من صحة البيانات المرفوعة والتواصل مع الإدارة.');
    }
  } catch (notifyErr) {
    console.error('Error sending user verification notification:', notifyErr);
  }
}));

router.delete('/:id', auth.protect, auth.restrictTo('admin'), catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return next(new AppError('لا يوجد مستخدم', 404));
  res.status(204).json({ status: 'success', data: null });
}));

module.exports = router;
