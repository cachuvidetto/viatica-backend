import { Request, Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { hashPassword, verifyPassword } from '../utils/password';
import { signToken } from '../utils/jwt';
import knex from '../utils/db';
import { ApiError } from '../utils/error';

// نموذج طلب التسجيل المحدث
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  phone: z.string().optional(),
  address: z.string().optional(),
  customer_type: z.enum(['company', 'individual']),
  role: z.enum(['owner', 'user']).optional().default('user'),
  invitation_code: z.string().optional(),
  company_name: z.string().optional()
});

export async function register(req: Request, res: Response) {
  try {
    const { 
      email, 
      password, 
      first_name, 
      last_name, 
      phone, 
      address, 
      customer_type, 
      role,
      invitation_code,
      company_name
    } = registerSchema.parse(req.body);

    const key = email.toLowerCase();

    // التحقق إذا كان المستخدم موجود بالفعل
    const existingUser = await knex('users').where({ email: key }).first();
    if (existingUser) {
      throw new ApiError(409, 'Email already registered');
    }

    let customerId: number;

    // تحديد customer_id بناءً على نوع التسجيل
    if (customer_type === 'company' && role === 'owner') {
      // إنشاء شركة جديدة
      const [newCustomerId] = await knex('customers').insert({
        first_name: company_name || `${first_name} ${last_name}'s Company`,
        second_name: '',
        email: key,
        address: address || '',
        phone: phone || '',
        customer_type: 'company',
        registration_date: new Date()
      });

      customerId = newCustomerId;

    } else if (invitation_code) {
      // البحث عن الشركة بواسطة invitation_code
      const company = await knex('customers')
        .where({ 
          invitation_code: invitation_code.trim(),
          customer_type: 'company' 
        })
        .first();
      
      if (!company) {
        throw new ApiError(404, 'Invalid invitation code or company not found');
      }
      
      customerId = company.customer_id;

    } else {
      throw new ApiError(400, 'Invitation code required for joining existing company');
    }

    const passwordHash = await hashPassword(password);
    const userId = randomUUID();

    // إدراج المستخدم في قاعدة البيانات
    await knex('users').insert({
      user_id: userId,
      customer_id: customerId,
      email: key,
      password_hash: passwordHash,
      first_name,
      last_name,
      phone: phone || '',
      role: role || 'user',
      registration_date: new Date(),
      created_at: new Date()
    });

    const token = signToken({ 
      sub: userId, 
      role: role || 'user'  // تم التصحيح
    });
    
    res.status(201).json({ 
      token, 
      user: { 
        id: userId, 
        email: key, 
        role: role || 'user',
        first_name,
        last_name,
        customer_id: customerId
      } 
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Failed to register user');
  }
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function login(req: Request, res: Response) {
  const { email, password } = loginSchema.parse(req.body);
  
  try {
    const user = await knex('users')
      .where({ email: email.toLowerCase() })
      .first();

    if (!user) throw new ApiError(401, 'Invalid credentials');

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) throw new ApiError(401, 'Invalid credentials');

    const token = signToken({ 
      sub: user.user_id, 
      role: user.role 
    });
    
    res.status(200).json({ 
      token, 
      user: { 
        id: user.user_id, 
        email: user.email, 
        role: user.role,
        first_name: user.first_name,
        last_name: user.last_name,
        customer_id: user.customer_id
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    throw new ApiError(500, 'Failed to login');
  }
}