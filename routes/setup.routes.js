const express = require('express');
const router = express.Router();
const User = require('../models/User');
const crypto = require('crypto');

const timingSafeEqual = (a, b) => {
  const aBuf = Buffer.from(String(a || ''));
  const bBuf = Buffer.from(String(b || ''));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

const requireBootstrapSecret = (req, res) => {
  // Allow only with explicit secret in ALL environments (safe default)
  const expected = process.env.SETUP_BOOTSTRAP_SECRET;
  const provided = req.get('x-bootstrap-secret') || req.query.secret;
  if (!expected || !timingSafeEqual(provided, expected)) {
    res.status(404).json({ status: 'fail', message: 'Not found' });
    return false;
  }
  return true;
};

const generateStrongPassword = () => crypto.randomBytes(18).toString('base64url');

router.get('/create-admin', async (req, res) => {
  if (!requireBootstrapSecret(req, res)) return;
  try {
    const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@viatica.com').toLowerCase();
    const phone = process.env.BOOTSTRAP_ADMIN_PHONE || '0900000000';
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || generateStrongPassword();

    // 1) Delete existing admin with same email (bootstrap behavior)
    await User.deleteOne({ email });

    // 2) Create new admin (hooks will handle hashing automatically)
    const user = await User.create({
      name: 'Admin Owner',
      email,
      password,
      role: 'admin',
      phone,
      isVerified: true,
      status: 'verified'
    });

    res.status(200).json({
      status: 'success',
      message: 'Admin user created successfully',
      data: {
        email: user.email,
        password
      }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

module.exports = router;
