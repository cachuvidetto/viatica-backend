const express = require('express');
const returnController = require('../controllers/return.controller');
const auth = require('../middlewares/auth');

const router = express.Router();

router.use(auth.protect);
router.use(auth.restrictTo('warehouse', 'admin'));

router.post('/', returnController.createReturn);
router.get('/', returnController.getReturns);
router.get('/:id', returnController.getReturnById);

module.exports = router;
