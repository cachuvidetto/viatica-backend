// backend/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 10,                  // 10 طلبات فقط
  message: 'Too many attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});