// backend/src/controllers/userController.ts
import { Request, Response } from 'express';
import { ApiError } from '../utils/error';
import prisma from '../utils/prisma';
import { z } from 'zod';
import { hashPassword } from '../utils/password';

// Schema for creating a user (Admin creating a user manually - optional, mostly via invite now)
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['admin', 'user']).default('user')
});

export const createUser = async (req: Request, res: Response) => {
  try {
    const userData = createUserSchema.parse(req.body);
    const customerId = (req as any).user?.customer_id;

    if (!customerId) {
      throw new ApiError(401, 'User context missing');
    }

    const passwordHash = await hashPassword(userData.password);

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role.toUpperCase() as any, // Map to Prisma Enum
        customerId,
        isVerified: true, // Manually created users are verified? Or send invite?
        isActive: true
      }
    });

    res.status(201).json({
      message: 'User created successfully',
      userId: user.id
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(400, 'Invalid input data');
    }
    throw new ApiError(500, 'Failed to create user');
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).user?.customer_id;

    if (!customerId) {
      throw new ApiError(401, 'User context missing');
    }

    const users = await prisma.user.findMany({
      where: { customerId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        lastVerificationSent: true,
        isVerified: true
      }
    });

    res.json({ users });
  } catch (error) {
    throw new ApiError(500, 'Failed to fetch users');
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const customerId = (req as any).user?.customer_id;

    // Ensure we only delete users from OUR customer/organization
    const deleted = await prisma.user.deleteMany({
      where: {
        id: parseInt(userId),
        customerId: customerId
      }
    });

    if (deleted.count === 0) {
      throw new ApiError(404, 'User not found or not authorized to delete');
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    throw new ApiError(500, 'Failed to delete user');
  }
};