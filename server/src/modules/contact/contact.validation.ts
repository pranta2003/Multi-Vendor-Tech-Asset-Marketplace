import { z } from 'zod';
import { SupportTicketStatus } from '@prisma/client';

export const INQUIRY_TYPES = [
  'General Question',
  'Order Issue',
  'Payment Issue',
  'Download / License Issue',
  'Account Issue',
  'Technical Problem',
  'Vendor Concern',
  'Complaint / Allegation',
  'Other',
] as const;

export type InquiryType = (typeof INQUIRY_TYPES)[number];

const phoneRegex = /^(\+?[0-9\s\-()]{7,24})?$/;

export const createContactSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120, 'Name cannot exceed 120 characters'),
    email: z.string().trim().toLowerCase().email('Please enter a valid email address').max(255, 'Email cannot exceed 255 characters'),
    phone: z
      .string()
      .trim()
      .max(24, 'Phone number cannot exceed 24 characters')
      .regex(phoneRegex, 'Invalid phone number format')
      .optional()
      .or(z.literal('')),
    subject: z.string().trim().min(4, 'Subject must be at least 4 characters').max(200, 'Subject cannot exceed 200 characters'),
    inquiryType: z.enum(INQUIRY_TYPES, {
      errorMap: () => ({ message: 'Please select a valid inquiry type' }),
    }),
    orderId: z.string().trim().max(64, 'Order ID cannot exceed 64 characters').optional().or(z.literal('')),
    message: z.string().trim().min(10, 'Message must be at least 10 characters').max(3000, 'Message cannot exceed 3000 characters'),
    // Honeypot field for anti-bot spam protection
    hp: z.string().optional().or(z.literal('')),
  }),
});

export const listTicketsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(50).default(10),
    status: z.nativeEnum(SupportTicketStatus).optional(),
    inquiryType: z.string().trim().optional(),
    search: z.string().trim().max(100).optional(),
  }),
});

export const updateTicketStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid ticket ID format'),
  }),
  body: z.object({
    status: z.nativeEnum(SupportTicketStatus, {
      errorMap: () => ({ message: 'Invalid support ticket status' }),
    }),
    adminNotes: z.string().trim().max(2000, 'Admin notes cannot exceed 2000 characters').optional().or(z.literal('')),
  }),
});

export const ticketIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid ticket ID format'),
  }),
});
