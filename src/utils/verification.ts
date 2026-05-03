// backend/src/utils/verification.ts - الملف الكامل
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const generateVerificationCode = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString(); // 4 خانات عشوائية
};

export const isVerificationCodeExpired = (expiresAt: Date): boolean => {
  return new Date() > expiresAt;
};

export const sendVerificationCode = async (email: string, code: string): Promise<void> => {
  try {
    await resend.emails.send({
      from: 'PowerFlow <onboarding@resend.dev>',
      to: email,
      subject: 'Verify Your PowerFlow Account',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
            <h2 style="color: #1976d2;">🎯 PowerFlow License Management</h2>
            <p>Your verification code is:</p>
            <div style="font-size: 32px; font-weight: bold; color: #1976d2; text-align: center; margin: 20px 0;">
              ${code}
            </div>
            <p>This code will expire in <strong>15 minutes</strong>.</p>
            <p>If you didn't request this verification, please ignore this email.</p>
          </div>
        </div>
      `
    });
    console.log(`✅ Verification email sent to ${email}`);
  } catch (error: any) {
    console.error('❌ Resend error:', error.message);
    // نسخة احتياطية
    console.log(`📧 [BACKUP] Verification code for ${email}: ${code}`);
  }
};

export const validateVerificationCode = (
  inputCode: string, 
  storedCode: string, 
  expiresAt: Date
): boolean => {
  return inputCode === storedCode && !isVerificationCodeExpired(expiresAt);
};