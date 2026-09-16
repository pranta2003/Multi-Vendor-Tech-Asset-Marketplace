import { z } from 'zod';
import { Role } from '@prisma/client';

const password = z.string()
  .min(8, 'Password must contain at least 8 characters')
  .max(128, 'Password must contain at most 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const email = z.string().trim().toLowerCase().email('Invalid email address').max(255);

const phone = z.string().optional().transform((v) => v?.trim() || undefined).pipe(
  z.string().regex(/^(?:\+?88)?01[3-9]\d{8}$/, 'Invalid Bangladeshi phone number').optional()
);

const storeName = z.string().optional().transform((v) => v?.trim() || undefined).pipe(
  z.string().min(3, 'Store name must be at least 3 characters').max(80, 'Store name must be at most 80 characters').optional()
);

export const registerSchema = z.object({
  body: z.object({
    email,
    password,
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120, 'Full name must be at most 120 characters'),
    phone,
    role: z.enum([Role.CUSTOMER, Role.VENDOR]).default(Role.CUSTOMER),
    storeName,
  }).refine((d) => d.role !== Role.VENDOR || Boolean(d.storeName),
    { message: 'Store name is required when registering as a vendor', path: ['storeName'] }),
});

export const loginSchema = z.object({
  body: z.object({ email, password: z.string().min(1, 'Password is required') }),
});

export const changePasswordSchema = z.object({
  body: z.object({ currentPassword: z.string().min(1), newPassword: password }),
});

export const googleAuthSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, 'Google ID token is required'),
    role: z.enum([Role.CUSTOMER, Role.VENDOR]).default(Role.CUSTOMER),
    storeName,
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>['body'];
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>['body'];
