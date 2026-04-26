const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./middlewares/error');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const drugRoutes = require('./routes/drug.routes');
const orderRoutes = require('./routes/order.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const offerRoutes = require('./routes/offer.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const ledgerRoutes = require('./routes/ledger.routes');
const adminRoutes = require('./routes/admin.routes');
const notificationRoutes = require('./routes/notification.routes');
const importRoutes = require('./routes/import.routes');
const reportRoutes = require('./routes/report.routes');
const returnRoutes = require('./routes/return.routes');
const feedRoutes = require('./routes/feed.routes');
const expenseRoutes = require('./routes/expense.routes');
const auditLogger = require('./middlewares/auditLogger');

const app = express();

// Trust proxy if behind reverse proxy
app.set('trust proxy', 1);

app.use(cors({
  origin: true, // Allows any origin dynamically, required for credentials: true
  credentials: true
}));

// Security HTTP headers
app.use(helmet());

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// Body parser
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());
// Data sanitization against XSS
app.use(xss());
// Prevent parameter pollution
app.use(hpp());

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Optional: audit logger (safe)
if (String(process.env.ENABLE_AUDIT).toLowerCase() === 'true') {
  app.use(auditLogger);
}

const setupRoutes = require('./routes/setup.routes');

// Routes
console.log('📍 Registering routes...');

// Health check (for Render / monitoring)
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: '🟢 Viatica API is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/v1/setup', setupRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/drugs', drugRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/offers', offerRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/ledger', ledgerRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/import', importRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/returns', returnRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/feed', feedRoutes);
app.use('/api/v1/expenses', expenseRoutes);
console.log('✅ Routes registered successfully');

// 404 handler
app.all('*', (req, res, next) => {
  next(new AppError(`لا يوجد مسار ${req.originalUrl} على هذا الخادم`, 404));
});

// Global error handler
app.use(globalErrorHandler);

module.exports = app;
