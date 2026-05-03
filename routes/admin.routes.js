const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const adminController = require('../controllers/admin.controller');
const User = require('../models/User');
const crypto = require('crypto');

const timingSafeEqual = (a, b) => {
  const aBuf = Buffer.from(String(a || ''));
  const bBuf = Buffer.from(String(b || ''));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

const requireEmergencySecret = (req, res) => {
  const expected = process.env.ADMIN_EMERGENCY_SECRET;
  const provided = req.get('x-emergency-secret') || req.query.secret;
  if (!expected || !timingSafeEqual(provided, expected)) {
    res.status(404).json({ status: 'fail', message: 'Not found' });
    return false;
  }
  return true;
};

const generateStrongPassword = () => crypto.randomBytes(18).toString('base64url');

// Emergency admin reset (requires secret; keep disabled unless explicitly enabled)
router.get('/emergency-fix-admin', async (req, res) => {
  if (!requireEmergencySecret(req, res)) return;
  try {
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      admin = new User({ name: 'Admin', email: 'admin@viatica.com', role: 'admin', isVerified: true, phone: '090000' });
    }
    const newPassword = process.env.ADMIN_EMERGENCY_PASSWORD || generateStrongPassword();
    admin.password = newPassword;
    await admin.save();
    res.status(200).json({ status: 'success', message: 'Admin password has been reset', data: { email: admin.email, password: newPassword } });
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

router.get('/profit-loss',
  auth.protect,
  auth.restrictTo('admin', 'warehouse'),
  adminController.getProfitAndLoss
);

router.post('/seed-demo',
  auth.protect,
  auth.restrictTo('admin', 'warehouse'),
  adminController.seedDemoData
);

module.exports = router;