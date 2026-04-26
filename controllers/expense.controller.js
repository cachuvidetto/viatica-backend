const catchAsync = require('../utils/catchAsync');
const Expense = require('../models/Expense');

const categoryLabels = {
  rent: 'إيجار',
  salaries: 'رواتب',
  transport: 'نقل وتوصيل',
  utilities: 'خدمات (كهرباء/ماء/إنترنت)',
  maintenance: 'صيانة',
  other: 'متفرقة'
};

// Create expense
exports.createExpense = catchAsync(async (req, res) => {
  const expense = await Expense.create({
    ...req.body,
    warehouse: req.user._id
  });
  res.status(201).json({ status: 'success', data: { expense } });
});

// Get all expenses (with optional date filter)
exports.getExpenses = catchAsync(async (req, res) => {
  const { startDate, endDate, category } = req.query;
  const filter = { warehouse: req.user._id };

  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = new Date(startDate);
    if (endDate) filter.date.$lte = new Date(endDate + 'T23:59:59');
  }
  if (category && category !== 'all') filter.category = category;

  const expenses = await Expense.find(filter).sort('-date').lean();

  // Summary by category
  const summary = {};
  let total = 0;
  expenses.forEach(e => {
    if (!summary[e.category]) summary[e.category] = { total: 0, count: 0, label: categoryLabels[e.category] || e.category };
    summary[e.category].total += e.amount;
    summary[e.category].count += 1;
    total += e.amount;
  });

  res.status(200).json({
    status: 'success',
    data: {
      expenses,
      summary,
      total,
      count: expenses.length
    }
  });
});

// Delete expense
exports.deleteExpense = catchAsync(async (req, res) => {
  await Expense.findOneAndDelete({ _id: req.params.id, warehouse: req.user._id });
  res.status(204).json({ status: 'success', data: null });
});

// Monthly summary (for dashboard widget)
exports.getMonthlySummary = catchAsync(async (req, res) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const agg = await Expense.aggregate([
    { $match: { warehouse: req.user._id, date: { $gte: startOfMonth } } },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    { $sort: { total: -1 } }
  ]);

  const grandTotal = agg.reduce((s, a) => s + a.total, 0);

  res.status(200).json({
    status: 'success',
    data: {
      categories: agg.map(a => ({ ...a, label: categoryLabels[a._id] || a._id })),
      grandTotal
    }
  });
});
