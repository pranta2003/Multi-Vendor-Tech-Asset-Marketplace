import { z } from 'zod';
import { Role } from '@prisma/client';

const password = z.string().min(8).max(128)
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[0-9]/, 'Must contain a number');

const email = z.string().trim().toLowerCase().email('Invalid email address').max(255);

export const registerSchema = z.object({
  body: z.object({
    email, password,
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().regex(/^(?:\+?88)?01[3-9]\d{8}$/, 'Invalid Bangladeshi phone number').optional(),
    role: z.enum([Role.CUSTOMER, Role.VENDOR]).default(Role.CUSTOMER),
    storeName: z.string().trim().min(3).max(80).optional(),
  }).refine((d) => d.role !== Role.VENDOR || Boolean(d.storeName),
    { message: 'storeName is required when registering as a vendor', path: ['storeName'] }),
});

export const loginSchema = z.object({
  body: z.object({ email, password: z.string().min(1, 'Password is required') }),
});

export const changePasswordSchema = z.object({
  body: z.object({ currentPassword: z.string().min(1), newPassword: password }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
