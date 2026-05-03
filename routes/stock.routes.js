const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const stockController = require('../controllers/stock.controller');

router.use(auth.protect);

// Warehouse/pharmacist: view own movements. Admin: can pass ?warehouse=
router.get('/movements', auth.restrictTo('admin', 'warehouse', 'pharmacist'), stockController.getStockMovements);

module.exports = router;

