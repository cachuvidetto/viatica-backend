import { Request, Response } from 'express';
import { ApiError } from '../utils/error';
import knex from '../utils/db';
import { z } from 'zod';

const createCustomerSchema = z.object({
  first_name: z.string().min(1),
  second_name: z.string().min(1),
  email: z.string().email(),
  address: z.string().optional(),
  phone: z.string().optional(),
  customer_type: z.enum(['company', 'individual'])
});

export const createCustomer = async (req: Request, res: Response) => {
  try {
    const customerData = createCustomerSchema.parse(req.body);
    
    const [customerId] = await knex('customers').insert({
      ...customerData,
      registration_date: new Date()
    });
    
    res.status(201).json({
      message: 'تم إناء العميل بنجاح',
      customer_id: customerId
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    throw new ApiError(500, 'Failed to create customer');
  }
};

export const getAllCustomers = async (req: Request, res: Response) => {
  try {
    const customers = await knex('customers').select('*');
    res.json({ customers });
  } catch (error) {
    throw new ApiError(500, 'Failed to fetch customers');
  }
};