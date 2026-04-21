const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const invoiceController = require('../controllers/invoice.controller');

router.use(auth.protect);

// Generate invoice from existing order
router.post('/', auth.restrictTo('warehouse','admin'), invoiceController.generateInvoice);

// Create direct invoice (from POS)
router.post('/direct', auth.restrictTo('warehouse'), invoiceController.createDirectInvoice);

// List invoices
router.get('/', invoiceController.getAllInvoices);

// Get single invoice (for print view)
router.get('/:id', invoiceController.getInvoiceById);

module.exports = router;
