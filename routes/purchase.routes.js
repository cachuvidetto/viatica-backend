const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const pc = require('../controllers/purchase.controller');

router.use(auth.protect);
router.use(auth.restrictTo('warehouse'));

router.get('/summary', pc.getPurchaseSummary);

router.route('/')
  .get(pc.getPurchases)
  .post(pc.createPurchase);

router.route('/:id')
  .get(pc.getPurchase)
  .delete(pc.deletePurchase);

module.exports = router;
