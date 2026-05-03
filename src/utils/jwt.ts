// backend/src/utils/jwt.ts
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface TokenPayload {
  sub: number;
  role: string;
  email: string;
  customer_id: number;
}

export const signToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token: string): TokenPayload => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // التحقق من أن decoded هو كائن وليس سلسلة
    if (typeof decoded === 'string') {
      throw new Error('Invalid token format');
    }

    // التحقق من وجود الخصائص المطلوبة
    if (!decoded || typeof decoded !== 'object') {
      throw new Error('Invalid token payload');
    }

    // التحويل إلى TokenPayload
    return {
      sub: Number(decoded.sub),
      role: String(decoded.role),
      email: String(decoded.email),
      customer_id: Number(decoded.customer_id)
    };
  } catch (error) {
    throw new Error('Token verification failed');
  }
};