// backend/src/controllers/licenseController.ts - Prisma Version
import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/error';
import prisma from '../utils/prisma';
import { v4 as uuidv4 } from 'uuid';

// Schema for purchasing a license
const purchaseSchema = z.object({
  planType: z.enum(['yearly', '3years', 'floating']),
  seats: z.number().min(1),
  phoneNumber: z.string(), // For mock payment verification
});

// Schema for validating a license (Desktop App)
const validateSchema = z.object({
  licenseKey: z.string(),
  pcUuid: z.string(),
  username: z.string().optional(),
});

export const purchaseLicense = async (req: Request, res: Response) => {
  try {
    const { planType, seats, phoneNumber } = purchaseSchema.parse(req.body);

    // 1. Mock Payment Verification
    // In production, this would be a Stripe/PayPal webhook
    if (phoneNumber !== '0966262458') {
      throw new ApiError(402, 'Payment Failed: Invalid phone number for test mode.');
    }

    // 2. Get User (Admin)
    // In a real app, we get this from req.user (Auth Middleware)
    // For now, we assume the user is logged in and we have their ID
    const userId = (req as any).user?.user_id;
    if (!userId) {
      throw new ApiError(401, 'User not authenticated');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customer: true }
    });

    if (!user) throw new ApiError(404, 'User not found');

    // 3. Calculate Expiry
    const issueDate = new Date();
    const expiryDate = new Date();
    let yearsToAdd = 1;
    if (planType === 'yearly') yearsToAdd = 1;
    if (planType === '3years') yearsToAdd = 3;
    if (planType === 'floating') yearsToAdd = 100; // Lifetime-ish
    expiryDate.setFullYear(expiryDate.getFullYear() + yearsToAdd);

    // 4. Generate Licenses (Seats)
    // We create one row per seat, sharing the same "Group" logic if needed, 
    // but for legacy compatibility, each seat is a row in 'licenses' table.

    const createdLicenses: any[] = [];

    // Use transaction to ensure all seats are created
    await prisma.$transaction(async (tx) => {
      for (let i = 1; i <= seats; i++) {
        const licenseKey = `LIC-${uuidv4().substring(0, 8).toUpperCase()}-${Date.now()}`;

        const license = await tx.license.create({
          data: {
            customerId: user.customerId,
            key: licenseKey,           // Maps to license_hash
            type: planType,            // Maps to license_type
            seatNumber: i,             // Maps to seat_number
            expiryDate: expiryDate,    // Maps to expiration_date
            issueDate: issueDate,      // Maps to issue_date
            isFree: 0,                 // Maps to is_free
            isActive: true,            // Maps to is_active
            // Legacy fields that are initially empty until used
            username: null,
            pcUuid: null,
          }
        });
        createdLicenses.push(license);
      }
    });

    res.status(201).json({
      success: true,
      message: `Successfully purchased ${seats} seats for ${planType} plan.`,
      data: createdLicenses
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(400, 'Invalid input data');
    }
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Purchase Error:', error);
    throw new ApiError(500, 'Purchase failed');
  }
};

// The API endpoint for the Desktop App
export const validateLicense = async (req: Request, res: Response) => {
  try {
    const { licenseKey, pcUuid, username } = validateSchema.parse(req.body);

    // 1. Find License
    const license = await prisma.license.findUnique({
      where: { key: licenseKey }
    });

    if (!license) {
      return res.status(404).json({ valid: false, message: 'License key not found' });
    }

    // 2. Check Status
    if (!license.isActive) {
      return res.status(403).json({ valid: false, message: 'License is inactive' });
    }

    // 3. Check Expiry
    if (new Date() > license.expiryDate) {
      return res.status(403).json({ valid: false, message: 'License expired' });
    }

    // 4. Bind to Machine (First Use Logic)
    // If this license has no PC UUID yet, bind it to this machine
    if (!license.pcUuid) {
      await prisma.license.update({
        where: { id: license.id },
        data: {
          pcUuid: pcUuid,
          username: username || 'Unknown',
          lastActivity: new Date()
        }
      });
    } else if (license.pcUuid !== pcUuid) {
      // If it's bound to a DIFFERENT machine
      return res.status(403).json({ valid: false, message: 'License is bound to another machine' });
    } else {
      // Correct machine, update activity
      await prisma.license.update({
        where: { id: license.id },
        data: { lastActivity: new Date() }
      });
    }

    // 5. Success
    res.json({
      valid: true,
      plan: license.type,
      expiry: license.expiryDate,
      seats: 1 // Legacy view
    });

  } catch (error) {
    console.error('Validation Error:', error);
    res.status(500).json({ valid: false, message: 'Server error' });
  }
};

export const getAllLicenses = async (req: Request, res: Response) => {
  try {
    // Get licenses for the logged-in user's customer (Organization)
    const userId = (req as any).user?.user_id;
    const customerId = (req as any).user?.customer_id;

    if (!customerId) {
      throw new ApiError(401, 'User context missing');
    }

    const licenses = await prisma.license.findMany({
      where: { customerId: customerId },
      orderBy: { issueDate: 'desc' }
    });

    res.json({
      success: true,
      licenses
    });
  } catch (error) {
    throw new ApiError(500, 'Failed to fetch licenses');
  }
};