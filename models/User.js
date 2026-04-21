const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'الرجاء إدخال الاسم الكامل'],
    trim: true,
    maxlength: [100, 'لا يمكن أن يزيد الاسم عن 100 حرف']
  },
  pharmacyName: {
    type: String,
    trim: true
  },
  email: {
    type: String,
    unique: true,
    lowercase: true,
    sparse: true, // Allow null/undefined to be unique
    validate: [validator.isEmail, 'الرجاء إدخال بريد إلكتروني صالح']
  },
  phone: {
    type: String,
    unique: true,
    sparse: true
  },
  role: {
    type: String,
    enum: ['admin', 'pharmacist', 'warehouse', 'driver', 'customer'],
    default: 'pharmacist'
  },
  warehouse: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    // required: function () { return this.role === 'driver'; } // Temporarily disabled for V0 simplicity
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending_review', 'verified', 'rejected', 'suspended'],
    default: 'pending_review'
  },
  licenseImage: {
    type: String
  },
  password: {
    type: String,
    minlength: 8,
    select: false
  },
  fcmToken: {
    type: String, // Firebase Cloud Messaging Token for Push Notifications
    select: false // Avoid sending it to frontend automatically
  },
  otp: {
    type: String,
    select: false
  },
  otpExpires: Date,
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0,0] } // [lng, lat]
  },
  
  // --- حقول خاصة بالمستودعات فقط ---
  logo: {
    type: String, // رابط صورة الشعار
    default: 'default-warehouse.png'
  },
  commercialRegister: {
    type: String, // رقم أو رابط صورة السجل التجاري
  },
  managerName: {
    type: String, // اسم المدير المسؤول
  },
  warehouseType: {
    type: String,
    enum: ['موزع معتمد', 'مستودع عام', 'شركة مصنعة'],
    default: 'مستودع عام'
  },
  addressText: {
    type: String, // تفاصيل العنوان (شارع، مبنى)
  },
  invoiceFooterText: {
    type: String,
    default: 'نشكر لكم ثقتكم بنا. تم إصدار هذه الفاتورة عبر نظام Viatica.'
  }
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });
userSchema.index({ location: '2dsphere' });

// Hash password
userSchema.pre('save', async function(next){
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.pre('save', function(next){
  if (!this.isModified('password') || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000; // ensure token is created after this time
  next();
});

userSchema.methods.correctPassword = async function(candidatePassword, userPassword){
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function(JWTTimestamp){
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function(){
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

module.exports = mongoose.model('User', userSchema);
