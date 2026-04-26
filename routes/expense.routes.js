const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const expenseController = require('../controllers/expense.controller');

router.use(auth.protect);
router.use(auth.restrictTo('admin', 'warehouse'));

router.route('/')
  .get(expenseController.getExpenses)
  .post(expenseController.createExpense);

router.get('/monthly-summary', expenseController.getMonthlySummary);

router.delete('/:id', expenseController.deleteExpense);

module.exports = router;
