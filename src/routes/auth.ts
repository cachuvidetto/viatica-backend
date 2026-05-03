// backend/src/routes/auth.ts
import { Router } from 'express';
import { login, register } from '../controllers/authController';
import { requireAuth } from '../middlewares/auth';

const authRouter = Router();

// 🔹 مسارات المصادقة
authRouter.post('/login', login);
authRouter.post('/register', register);
authRouter.get('/profile', requireAuth([])); // ✅ بدون أقواس فارغة

export default authRouter;