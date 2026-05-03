console.log('🔑 RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
console.log('🌐 NODE_ENV:', process.env.NODE_ENV); import express from 'express';
import cors from 'cors';
import { notFound, errorHandler } from './utils/error';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import verificationRouter from './routes/verification';
import licenseRouter from './routes/license';
import invitationRouter from './routes/invitation';

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/verify', verificationRouter);
app.use('/api/v1/license', licenseRouter);
app.use('/api/invitations', invitationRouter);
app.use(notFound);
app.use(errorHandler);
app.listen(4000, () => {
  console.log('Server running on port 4000');
});