const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const orderController = require('../controllers/order.controller');

router.use(auth.protect);

// Static routes MUST come before param routes
router.get('/', orderController.getAllOrders);
router.post('/', orderController.createOrder);
router.post('/manual-sale', auth.restrictTo('warehouse'), orderController.createManualSale);

// Param routes
router.get('/:id', orderController.getOrderById);
router.patch('/:id/status', orderController.updateOrderStatus);
router.patch('/:id/assign-driver', auth.restrictTo('warehouse','admin'), orderController.assignDriver);

module.exports = router;
