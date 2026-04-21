const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const adminController = require('../controllers/admin.controller');

router.get('/dashboard', 
  auth.protect,
  auth.restrictTo('admin', 'warehouse'),
  adminController.getDashboardStats
);

module.exports = router;