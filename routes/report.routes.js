const express = require('express');
const reportController = require('../controllers/report.controller');
const auth = require('../middlewares/auth');

const router = express.Router();

router.use(auth.protect);
router.use(auth.restrictTo('warehouse', 'admin'));

router.get('/sales', reportController.getSalesReport);

module.exports = router;
