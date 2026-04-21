const { promisify } = require('util');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Email = require('../utils/email');
const { signToken } = require('../utils/jwt');
const SmsProvider = require('../utils/smsProvider');

const createSendToken = (user, statusCode, res) => {
  const token = signToken({ id: user._id });
  const cookieOptions = {
    expires: new Date(Date.now() + (parseInt(process.env.JWT_COOKIE_EXPIRES_IN || '7', 10) * 24 * 60 * 60 * 1000)),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  };
  res.cookie('jwt', token, cookieOptions);
  user.password = undefined;
  res.status(statusCode).json({ status: 'success', token, data: { user } });
};

exports.register = catchAsync(async (req, res, next) => {
  // 🔐 Security: Strip sensitive fields from public registration
  // Only admin can create warehouse/admin/driver accounts (via admin panel)
  const safeBody = { ...req.body };
  
  // If the caller is NOT an admin, force safe defaults
  if (!req.user || req.user.role !== 'admin') {
    safeBody.role = 'pharmacist'; // Force pharmacist role for public registration
    delete safeBody.isVerified;
    delete safeBody.status;
  }

  const user = await User.create(safeBody);
  createSendToken(user, 201, res);
});

exports.sendOTP = catchAsync(async (req, res, next) => {
  const { phone } = req.body;
  if (!phone) return next(new AppError('الرجاء إدخال رقم الهاتف', 400));

  // 1) Generate OTP
  // Check if it's a test number (ends with 0000)
  const isTestNumber = phone.endsWith('0000');
  const otp = isTestNumber ? '1234' : Math.floor(1000 + Math.random() * 9000).toString();

  // 2) Hash it
  const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

  // 3) Save to user
  let user = await User.findOne({ phone });
  
  if (!user) {
    user = await User.create({
      phone,
      name: 'مستخدم جديد',
      otp: hashedOTP,
      otpExpires: Date.now() + 10 * 60 * 1000
    });
  } else {
    user.otp = hashedOTP;
    user.otpExpires = Date.now() + 10 * 60 * 1000;
    await user.save({ validateBeforeSave: false });
  }

  // 4) Send via Bridge
  await SmsProvider.send(phone, `رمز التحقق الخاص بك في فارمجي هو: ${otp}`);

  // Check if user is effectively new (not verified)
  // If we just created it (user was null before), it's new. 
  // If it existed but !isVerified, treat as new/incomplete.
  const isNewUser = !user.isVerified;

  res.status(200).json({
    status: 'success',
    message: 'تم إرسال رمز التحقق (راجع التيرمنال)',
    isNewUser
  });
});

exports.verifyOTP = catchAsync(async (req, res, next) => {
  const { phone, otp, name, lat, lng } = req.body; // Accept extra data
  if (!phone || !otp) return next(new AppError('الرجاء إدخال رقم الهاتف والرمز', 400));

  // 1) Hash the input OTP
  const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

  // 2) Find user with this phone and valid OTP
  const user = await User.findOne({
    phone,
    otp: hashedOTP,
    otpExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new AppError('الرمز غير صحيح أو منتهي الصلاحية', 400));
  }

  // 3) Update User Info & Clear OTP fields
  user.otp = undefined;
  user.otpExpires = undefined;
  
  // Update name if provided (and if it was a placeholder)
  if (name) user.name = name;
  
  // Update location if provided
  if (lat && lng) {
    user.location = {
      type: 'Point',
      coordinates: [parseFloat(lng), parseFloat(lat)]
    };
  }
  
  user.isVerified = true; // Mark as verified
  
  await user.save({ validateBeforeSave: false });

  // 4) Generate Token
  createSendToken(user, 200, res);
});

exports.login = catchAsync(async (req, res, next) => {
  // We accept either email or phone in the "email" field from frontend
  const identifier = req.body.email || req.body.phone;
  const password = req.body.password;
  
  if (!identifier || !password) return next(new AppError('الرجاء إدخال البريد الإلكتروني أو رقم الهاتف وكلمة المرور', 400));
  
  const user = await User.findOne({ 
    $or: [
      { email: identifier.toLowerCase() },
      { phone: identifier }
    ]
  }).select('+password');
  
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('بيانات الاعتماد غير صحيحة', 401));
  }
  
  createSendToken(user, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  if (!token) return next(new AppError('الرجاء تسجيل الدخول للوصول', 401));
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) return next(new AppError('المستخدم لم يعد موجودًا', 401));
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('تم تغيير كلمة المرور مؤخرًا، الرجاء تسجيل الدخول مجددًا', 401));
  }
  req.user = currentUser;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('ليس لديك صلاحية لتنفيذ هذا الإجراء', 403));
    }
    next();
  };
};

// 🔐 Optional auth — sets req.user if token exists, but doesn't block if no token
exports.optionalProtect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    }
    if (token) {
      const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
      const currentUser = await User.findById(decoded.id);
      if (currentUser) req.user = currentUser;
    }
  } catch (err) {
    // Silently ignore — user stays unauthenticated
  }
  next();
};

exports.getMe = (req, res) => {
  res.status(200).json({ status: 'success', data: { user: req.user } });
};

exports.verifyPharmacist = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndUpdate(
    req.params.id, 
    { isVerified: true, status: 'verified' }, 
    { new: true, runValidators: true }
  );
  if (!user) return next(new AppError('لا يوجد مستخدم بهذا المعرف', 404));
  res.status(200).json({ status: 'success', data: { user } });
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return next(new AppError('لا يوجد مستخدم بهذا البريد', 404));
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });
  const resetURL = `${req.protocol}://${req.get('host')}/api/v1/auth/resetPassword/${resetToken}`;
  try {
    await Email.sendPasswordReset(user, resetURL);
    res.status(200).json({ status: 'success', message: 'تم إرسال رابط إعادة التعيين إلى بريدك' });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError('حدث خطأ أثناء إرسال البريد. حاول لاحقًا.', 500));
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({ passwordResetToken: hashedToken, passwordResetExpires: { $gt: Date.now() } }).select('+password');
  if (!user) return next(new AppError('الرمز غير صالح أو منتهي', 400));
  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('+password');
  if (!user) return next(new AppError('المستخدم غير موجود', 404));
  if (!(await user.correctPassword(req.body.currentPassword, user.password))) {
    return next(new AppError('كلمة المرور الحالية غير صحيحة', 401));
  }
  user.password = req.body.newPassword;
  await user.save();
  createSendToken(user, 200, res);
});

exports.updateFcmToken = catchAsync(async (req, res, next) => {
  const { fcmToken } = req.body;
  if (!fcmToken) return next(new AppError('الرجاء توفير رمز FCM', 400));
  
  await User.findByIdAndUpdate(req.user.id, { fcmToken }, { new: true, runValidators: true });
  res.status(200).json({ status: 'success', message: 'تم تحديث رمز التنبيهات بنجاح' });
});

