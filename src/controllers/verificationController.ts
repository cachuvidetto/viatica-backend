// backend/src/controllers/verificationController.ts - Prisma Version
import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/error';
import prisma from '../utils/prisma'; // Import Prisma Client
import {
  generateVerificationCode,
  sendVerificationCode,
  validateVerificationCode
} from '../utils/verification';

const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(4, "Verification code must be 4 digits")
});

const resendCodeSchema = z.object({
  email: z.string().email()
});

export const verifyCode = async (req: Request, res: Response) => {
  try {
    const { email, code } = verifyCodeSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase();

    // 1. Find User
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // 2. Check if already verified
    if (user.isVerified) {
      throw new ApiError(400, 'Account is already verified');
    }

    // 3. Check if code exists
    if (!user.verificationCode || !user.verificationExpires) {
      throw new ApiError(400, 'No verification code found. Please request a new one.');
    }

    // 4. Validate Code
    const isValid = validateVerificationCode(
      code,
      user.verificationCode,
      new Date(user.verificationExpires)
    );

    if (!isValid) {
      // Increment attempts
      await prisma.user.update({
        where: { email: normalizedEmail },
        data: {
          verificationAttempts: { increment: 1 }
        }
      });

      throw new ApiError(400, 'Invalid or expired verification code');
    }

    // 5. Success: Verify User
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        isVerified: true,
        verificationCode: null,
        verificationExpires: null,
        verificationAttempts: 0
      }
    });

    res.json({
      success: true,
      message: 'Account verified successfully! You can now login.'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      throw new ApiError(400, `Invalid input: ${errorMessage}`);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Verification failed');
  }
};

export const resendVerificationCode = async (req: Request, res: Response) => {
  try {
    const { email } = resendCodeSchema.parse(req.body);
    const normalizedEmail = email.toLowerCase();

    // 1. Find User
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // 2. Check if already verified
    if (user.isVerified) {
      throw new ApiError(400, 'Account is already verified');
    }

    // 3. Rate Limit (1 minute)
    const lastSent = user.lastVerificationSent;
    const now = new Date();
    if (lastSent && (now.getTime() - new Date(lastSent).getTime()) < 60000) {
      throw new ApiError(429, 'Please wait 1 minute before requesting a new code');
    }

    // 4. Generate New Code
    const verificationCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    // 5. Update User
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        verificationCode: verificationCode,
        verificationExpires: expiresAt,
        lastVerificationSent: new Date(),
        verificationAttempts: 0
      }
    });

    // 6. Send Email
    await sendVerificationCode(normalizedEmail, verificationCode);

    res.json({
      success: true,
      message: 'Verification code sent successfully!'
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      throw new ApiError(400, `Invalid input: ${errorMessage}`);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to resend verification code');
  }
};