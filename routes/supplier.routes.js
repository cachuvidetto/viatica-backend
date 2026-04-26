const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const sc = require('../controllers/supplier.controller');

router.use(auth.protect);
router.use(auth.restrictTo('warehouse'));

router.route('/')
  .get(sc.getSuppliers)
  .post(sc.createSupplier);

router.route('/:id')
  .patch(sc.updateSupplier)
  .delete(sc.deleteSupplier);

module.exports = router;
