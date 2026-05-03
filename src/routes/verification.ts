// backend/src/routes/verification.ts
import { Router } from 'express';
import { verifyCode, resendVerificationCode } from '../controllers/verificationController';

const router = Router();

router.post('/verify', verifyCode);
router.post('/resend', resendVerificationCode);

export default router;