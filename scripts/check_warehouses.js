const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config({ path: '../.env' }); // Make sure to load env

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/viatica').then(async () => {
    console.log('Connected to DB');
    const warehouses = await User.find({ role: 'warehouse' }).select('name status isVerified role').lean();
    console.log("Warehouses in DB:\n", JSON.stringify(warehouses, null, 2));
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
