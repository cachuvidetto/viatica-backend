const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: '../.env' });

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/viatica').then(async () => {
    console.log('Connected to DB...');
    const result = await User.updateMany({ role: 'warehouse' }, { status: 'verified', isVerified: true });
    console.log(`Fixed warehouse statuses to verified. Modified ${result.modifiedCount} documents.`);
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
