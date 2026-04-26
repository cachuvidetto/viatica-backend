const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env' });
const User = require('../models/User');

async function checkLogin() {
  await mongoose.connect(process.env.DATABASE_FULL_URL);
  console.log('Connected DB');
  const user = await User.findOne({ email: 'admin@viatica.com' }).select('+password');
  if (!user) {
    console.log('User not found!');
  } else {
    console.log('User found:', user.email, 'Role:', user.role);
    const isMatch = await bcrypt.compare('admin123', user.password);
    console.log('Password Match for admin123:', isMatch);
    
    // Let's force reset it completely
    user.password = 'admin123';
    await user.save();
    console.log('Force saved admin password again.');
  }
  process.exit(0);
}

checkLogin();
