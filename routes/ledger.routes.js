const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const ledgerController = require('../controllers/ledger.controller');

// All routes are protected
router.use(auth.protect);

// Statement — existing simple route
router.get('/statement', async (req, res, next) => {
  try {
    const Ledger = require('../models/Ledger');
    const filter = {};
    if (req.user.role === 'pharmacist') filter.pharmacist = req.user._id;
    if (req.user.role === 'warehouse')  filter.warehouse = req.user._id;
    if (req.query.pharmacist) filter.pharmacist = req.query.pharmacist;
    if (req.query.warehouse)  filter.warehouse = req.query.warehouse;

    const entries = await Ledger.find(filter)
      .sort('-transactionDate')
      .populate('warehouse pharmacist', 'name pharmacyName')
      .populate('order', 'status');

    res.status(200).json({ status: 'success', results: entries.length, data: { entries } });
  } catch (err) { next(err); }
});

// NEW: Get all balances (per pharmacist) for a warehouse
router.get('/balances', auth.restrictTo('warehouse', 'admin'), ledgerController.getAccountsBalances);

// NEW: Add a payment (receipt voucher)
router.post('/payment', auth.restrictTo('warehouse'), ledgerController.addPayment);

// NEW: Get detailed statement for specific pharmacist
router.get('/statement/:pharmacistId', auth.restrictTo('warehouse', 'admin'), ledgerController.getAccountStatement);

module.exports = router;
