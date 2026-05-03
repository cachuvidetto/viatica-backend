// backend/src/controllers/invitationController.ts
import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../utils/error';
import prisma from '../utils/prisma';
import { v4 as uuidv4 } from 'uuid';
import { Resend } from 'resend';
import { hashPassword } from '../utils/password';

const resend = new Resend(process.env.RESEND_API_KEY);

const inviteSchema = z.object({
    email: z.string().email(),
});

export const inviteUser = async (req: Request, res: Response) => {
    try {
        const { email } = inviteSchema.parse(req.body);

        // Get current user (Inviter)
        const inviterId = (req as any).user?.user_id;
        const customerId = (req as any).user?.customer_id; // Organization ID

        if (!inviterId || !customerId) {
            throw new ApiError(401, 'User not authenticated');
        }

        // 1. Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new ApiError(400, 'User already exists in the system');
        }

        // 2. Check if pending invitation exists
        // We generate a new token regardless to allow re-inviting
        const token = uuidv4();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

        // 3. Create Invitation Record
        const invitation = await prisma.invitation.create({
            data: {
                email,
                token,
                inviterId,
                customerId,
                expiresAt,
                status: 'PENDING'
            }
        });

        // 4. Send Email
        const inviteLink = `http://localhost:3000/accept-invite?token=${token}`;

        try {
            await resend.emails.send({
                from: 'PowerFlow <onboarding@resend.dev>',
                to: email,
                subject: 'You have been invited to join PowerFlow Portal',
                html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px;">
              <h2 style="color: #1976d2;">🚀 Join the Team!</h2>
              <p>You have been invited to join the PowerFlow Portal organization.</p>
              <p>Click the button below to accept the invitation and set up your account:</p>
              <a href="${inviteLink}" style="display: inline-block; background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0;">Accept Invitation</a>
              <p style="color: #666; font-size: 12px;">This link expires in 7 days.</p>
            </div>
          </div>
        `
            });
            console.log(`✅ Invite email sent to ${email}`);
        } catch (emailError) {
            console.error('Failed to send email:', emailError);
            // Don't fail the request, just log it. The token is created.
        }

        res.status(201).json({
            success: true,
            message: `Invitation sent to ${email}`,
            invitationId: invitation.id
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new ApiError(400, 'Invalid email address');
        }
        if (error instanceof ApiError) throw error;
        console.error('Invite Error:', error);
        throw new ApiError(500, 'Failed to send invitation');
    }
};

export const getPendingInvitations = async (req: Request, res: Response) => {
    try {
        const customerId = (req as any).user?.customer_id;
        const invitations = await prisma.invitation.findMany({
            where: {
                customerId,
                status: 'PENDING'
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ success: true, invitations });
    } catch (error) {
        throw new ApiError(500, 'Failed to fetch invitations');
    }
};

const acceptInviteSchema = z.object({
    token: z.string(),
    password: z.string().min(6),
    firstName: z.string().min(1),
    lastName: z.string().min(1)
});

export const acceptInvite = async (req: Request, res: Response) => {
    try {
        const { token, password, firstName, lastName } = acceptInviteSchema.parse(req.body);

        // 1. Find Invitation
        const invitation = await prisma.invitation.findUnique({
            where: { token }
        });

        if (!invitation) {
            throw new ApiError(404, 'Invalid invitation token');
        }

        if (invitation.status !== 'PENDING') {
            throw new ApiError(400, 'Invitation already accepted or expired');
        }

        if (new Date() > invitation.expiresAt) {
            throw new ApiError(400, 'Invitation expired');
        }

        // 2. Create User
        const passwordHash = await hashPassword(password);

        const user = await prisma.user.create({
            data: {
                email: invitation.email,
                passwordHash,
                firstName,
                lastName,
                role: 'USER', // Default role for invited members
                customerId: invitation.customerId,
                isVerified: true,
                isActive: true
            }
        });

        // 3. Update Invitation Status
        await prisma.invitation.update({
            where: { id: invitation.id },
            data: { status: 'ACCEPTED' }
        });

        res.status(201).json({
            success: true,
            message: 'Invitation accepted successfully',
            userId: user.id
        });

    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new ApiError(400, 'Invalid input data');
        }
        if (error instanceof ApiError) throw error;
        console.error('Accept Invite Error:', error);
        throw new ApiError(500, 'Failed to accept invitation');
    }
};
