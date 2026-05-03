// backend/src/middlewares/auth.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import prisma from '../utils/prisma'; // Use Prisma

export const requireAuth = (roles: string[] = []) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
      }

      const decoded = verifyToken(token);

      // Use Prisma to find user
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub }, // decoded.sub is user_id
      });

      if (!user) {
        return res.status(401).json({ success: false, message: 'User not found' });
      }

      if (!user.isActive) {
        return res.status(401).json({ success: false, message: 'User is inactive' });
      }

      // Normalize role to lowercase for consistency
      // Prisma returns Enum (e.g. 'ADMIN'), app expects 'admin'
      const userRole = user.role.toLowerCase();

      // Add user info to request (maintain legacy shape)
      req.user = {
        user_id: user.id,
        email: user.email,
        role: userRole,
        customer_id: user.customerId
      };

      // Check permissions
      if (roles.length > 0 && !roles.includes(userRole)) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
  };
};
