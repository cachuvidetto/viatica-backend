const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const adminController = require('../controllers/admin.controller');
const User = require('../models/User');

// TEMP: Emergency admin reset
router.get('/emergency-fix-admin', async (req, res) => {
  try {
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      admin = new User({ name: 'Admin', email: 'admin@viatica.com', role: 'admin', isVerified: true, phone: '090000' });
    }
    admin.password = 'admin123';
    await admin.save();
    res.status(200).json({ status: 'success', message: 'Admin reset to admin123' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/dashboard', 
  auth.protect,
  auth.restrictTo('admin', 'warehouse'),
  adminController.getDashboardStats
);

router.get('/alerts/expiry',
  auth.protect,
  auth.restrictTo('admin', 'warehouse'),
  adminController.getExpiryAlerts
);

router.get('/alerts/stock',
  auth.protect,
  auth.restrictTo('admin', 'warehouse'),
  adminController.getStockAlerts
);

module.exports = router;