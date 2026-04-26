const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });
const User = require('../models/User');

async function ensureAdmin() {
  try {
    await mongoose.connect(process.env.DATABASE_FULL_URL);
    console.log('Connected to DB');

    let admin = await User.findOne({ email: 'admin@viatica.com' });
    if (!admin) {
      admin = new User({
        name: 'الإدارة العامة',
        email: 'admin@viatica.com',
        role: 'admin',
        isVerified: true,
        phone: '0900000000'
      });
    }
    admin.password = 'admin123';
    await admin.save();

    let warehouse = await User.findOne({ role: 'warehouse' });
    if (!warehouse) {
      warehouse = new User({
        name: 'مستودع تجريبي',
        email: 'warehouse@test.com',
        role: 'warehouse',
        isVerified: true,
        phone: '0912345678',
        warehouseType: 'مستودع عام'
      });
      warehouse.password = 'warehouse123';
      await warehouse.save();
    }

    console.log('✅ Admin and Warehouse users have been verified/created successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

ensureAdmin();
