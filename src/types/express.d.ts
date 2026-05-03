// backend/src/types/express.d.ts
import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        user_id: number;
        email: string;
        role: string;
        customer_id: number;
      };
    }
  }
}