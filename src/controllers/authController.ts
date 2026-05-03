// backend/src/controllers/authController.ts - Prisma Version
import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { signToken } from '../utils/jwt';
import { ApiError } from '../utils/error';
import prisma from '../utils/prisma'; // Import Prisma Client
import { generateVerificationCode, sendVerificationCode } from '../utils/verification';
import { Role, CustomerType } from '@prisma/client'; // Import Enums

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().optional(),
  customer_type: z.enum(['company', 'individual']),
  role: z.enum(['admin', 'user', 'owner']).default('user'),
  company_name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const register = async (req: Request, res: Response) => {
  // Prisma Transaction
  try {
    const result = await prisma.$transaction(async (tx) => {
      const { email, password, first_name, last_name, phone, customer_type, role, company_name } = registerSchema.parse(req.body);

      const normalizedEmail = email.toLowerCase();

      // 1. Check if user exists
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        throw new ApiError(409, 'User already exists');
      }

      // 2. Hash Password
      const passwordHash = await bcrypt.hash(password, 12);

      // 3. Map Enums (Frontend lowercase -> Prisma Uppercase)
      const mappedCustomerType = customer_type === 'company' ? CustomerType.COMPANY : CustomerType.INDIVIDUAL;
      const mappedRole = role === 'admin' ? Role.ADMIN : (role === 'owner' ? Role.OWNER : Role.USER);

      // 4. Create Customer
      const customer = await tx.customer.create({
        data: {
          email: normalizedEmail,
          firstName: first_name,
          lastName: last_name,
          phone: phone || null,
          customerType: mappedCustomerType,
          companyName: (customer_type === 'company' && company_name) ? company_name : null,
          registrationDate: new Date(),
        },
      });

      // 5. Generate Verification Code
      const verificationCode = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      // 6. Create User
      const user = await tx.user.create({
        data: {
          customerId: customer.id,
          email: normalizedEmail,
          passwordHash: passwordHash,
          firstName: first_name,
          lastName: last_name,
          role: mappedRole,
          isVerified: false,
          verificationCode: verificationCode,
          verificationExpires: expiresAt,
          isActive: true,
        },
      });

      return { user, verificationCode, normalizedEmail };
    });

    // 7. Send Email (Outside transaction to avoid rollback on email fail if desired, but here we keep logic same)
    // In original code, it was inside try/catch block of transaction wrapper.
    await sendVerificationCode(result.normalizedEmail, result.verificationCode);

    res.json({
      success: true,
      message: 'Registration successful. Please check your email for verification code.',
      email: result.normalizedEmail,
      next_step: 'verification'
    });

  } catch (error) {
    console.error('🔴 Register Error:', error);

    if (error instanceof z.ZodError) {
      throw new ApiError(400, 'Invalid input data');
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Registration failed');
  }
};

const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const normalizedEmail = email.toLowerCase();

    // 1. Find User
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new ApiError(401, 'Invalid email or password');
    }

    // 2. Check Verification
    if (!user.isVerified) {
      throw new ApiError(403, 'Please verify your email first');
    }

    // 3. Check Active
    if (!user.isActive) {
      throw new ApiError(403, 'Account is deactivated');
    }

    // 4. Check Password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      throw new ApiError(401, 'Invalid email or password');
    }

    // 5. Generate Token
    const token = signToken({
      sub: user.id,
      role: user.role.toLowerCase(), // Map back to lowercase for token if needed by frontend
      email: user.email,
      customer_id: user.customerId
    });

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
        role: user.role.toLowerCase(), // Map back to lowercase
        customer_id: user.customerId
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(400, 'Invalid email or password format');
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Login failed');
  }
};

export { register, login };