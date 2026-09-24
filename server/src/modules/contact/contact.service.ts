import { Prisma, SupportTicketStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/ApiError';
import { buildPagination } from '../../utils/ApiResponse';
import { generateTicketNumber } from '../../utils/identifiers';

import { logger } from '../../utils/logger';
import { sendTicketNotifications } from './notification.service';
import type { InquiryType } from './contact.validation';

export interface CreateContactInput {
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  inquiryType: InquiryType;
  orderId?: string | null;
  message: string;
  hp?: string | null;
}

export interface ListTicketsQuery {
  page: number;
  limit: number;
  status?: SupportTicketStatus;
  inquiryType?: string;
  search?: string;
}

/** Sanitize input strings to prevent HTML/script injection */
const sanitizeText = (input: string): string => {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, (char) => (char === '<' ? '&lt;' : '&gt;'))
    .trim();
};

let isSchemaEnsured = false;
let schemaInitPromise: Promise<void> | null = null;

/**
 * Ensures the support_tickets table and SupportTicketStatus enum exist in
 * PostgreSQL even on serverless deployments where migrations are applied
 * asynchronously.
 */
export async function ensureSupportSchema(): Promise<void> {
  if (isSchemaEnsured) return;
  if (schemaInitPromise) return schemaInitPromise;

  schemaInitPromise = (async () => {
    try {
      const ddlStatements = [
        `DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportTicketStatus') THEN
            CREATE TYPE "SupportTicketStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
          END IF;
        END $$;`,
        `CREATE TABLE IF NOT EXISTS "support_tickets" (
          "id" UUID NOT NULL DEFAULT gen_random_uuid(),
          "ticketNumber" VARCHAR(32) NOT NULL,
          "name" VARCHAR(120) NOT NULL,
          "email" CITEXT NOT NULL,
          "phone" VARCHAR(24),
          "subject" VARCHAR(200) NOT NULL,
          "inquiryType" VARCHAR(50) NOT NULL,
          "orderId" VARCHAR(64),
          "message" TEXT NOT NULL,
          "status" "SupportTicketStatus" NOT NULL DEFAULT 'NEW',
          "adminNotes" TEXT,
          "userId" UUID,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
        )`,
        `CREATE UNIQUE INDEX IF NOT EXISTS "support_tickets_ticketNumber_key" ON "support_tickets"("ticketNumber")`,
        `CREATE INDEX IF NOT EXISTS "support_tickets_status_createdAt_idx" ON "support_tickets"("status", "createdAt" DESC)`,
        `CREATE INDEX IF NOT EXISTS "support_tickets_email_idx" ON "support_tickets"("email")`,
        `CREATE INDEX IF NOT EXISTS "support_tickets_userId_idx" ON "support_tickets"("userId")`,
        `CREATE INDEX IF NOT EXISTS "support_tickets_ticketNumber_idx" ON "support_tickets"("ticketNumber")`,
        `DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'support_tickets_userId_fkey'
          ) THEN
            ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
        END $$;`
      ];

      for (const sql of ddlStatements) {
        await prisma.$executeRawUnsafe(sql);
      }
      isSchemaEnsured = true;
    } catch (err) {
      logger.error({ err }, 'Support schema check encountered error in DDL execution');
    } finally {
      schemaInitPromise = null;
    }
  })();

  return schemaInitPromise;
}

export async function createSupportTicket(
  input: CreateContactInput,
  authenticatedUserId?: string,
) {
  if (input.hp && input.hp.trim().length > 0) {
    logger.warn({ ip: 'honeypot_triggered', email: input.email }, 'Bot submission detected via honeypot field');
    throw new ValidationError('Invalid submission');
  }

  await ensureSupportSchema();

  const ticketNumber = generateTicketNumber();
  const cleanSubject = sanitizeText(input.subject);
  const cleanMessage = sanitizeText(input.message);
  const cleanName = sanitizeText(input.name);
  const cleanPhone = input.phone ? sanitizeText(input.phone) : null;
  const cleanOrderId = input.orderId ? sanitizeText(input.orderId) : null;

  const ticket = await prisma.supportTicket.create({
    data: {
      ticketNumber,
      name: cleanName,
      email: input.email.trim().toLowerCase(),
      phone: cleanPhone,
      subject: cleanSubject,
      inquiryType: input.inquiryType,
      orderId: cleanOrderId,
      message: cleanMessage,
      status: SupportTicketStatus.NEW,
      userId: authenticatedUserId ?? null,
    },
  });

  // Non-blocking notification dispatch
  void sendTicketNotifications({
    ticketNumber: ticket.ticketNumber,
    name: ticket.name,
    email: ticket.email,
    phone: ticket.phone,
    subject: ticket.subject,
    inquiryType: ticket.inquiryType,
    orderId: ticket.orderId,
    message: ticket.message,
    createdAt: ticket.createdAt,
  }).catch((err) => {
    logger.error({ err, ticketNumber: ticket.ticketNumber }, 'Error in ticket notification handler');
  });

  return ticket;
}

export async function listAllSupportTickets(query: ListTicketsQuery) {
  await ensureSupportSchema();

  const { page, limit, status, inquiryType, search } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.SupportTicketWhereInput = {};

  if (status) {
    where.status = status;
  }

  if (inquiryType) {
    where.inquiryType = inquiryType;
  }

  if (search && search.trim().length > 0) {
    const term = search.trim();
    where.OR = [
      { ticketNumber: { contains: term, mode: 'insensitive' } },
      { name: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
      { subject: { contains: term, mode: 'insensitive' } },
      { orderId: { contains: term, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
      },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  return {
    items,
    meta: buildPagination(page, limit, total),
  };
}

export async function listUserSupportTickets(userId: string, email: string) {
  await ensureSupportSchema();

  const tickets = await prisma.supportTicket.findMany({
    where: {
      OR: [
        { userId },
        { email: email.toLowerCase() },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return tickets;
}

export async function getSupportTicketById(id: string, caller: { id: string; email: string; role: string }) {
  await ensureSupportSchema();

  const ticket = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!ticket) {
    throw new NotFoundError('Support ticket not found');
  }

  const isAdmin = caller.role === 'ADMIN';
  const isOwner = ticket.userId === caller.id || ticket.email.toLowerCase() === caller.email.toLowerCase();

  if (!isAdmin && !isOwner) {
    throw new ForbiddenError('You do not have permission to view this support ticket');
  }

  return ticket;
}

export async function updateSupportTicketStatus(
  id: string,
  status: SupportTicketStatus,
  adminNotes?: string | null,
) {
  await ensureSupportSchema();

  const existing = await prisma.supportTicket.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError('Support ticket not found');
  }

  const updated = await prisma.supportTicket.update({
    where: { id },
    data: {
      status,
      adminNotes: adminNotes !== undefined ? (adminNotes ? sanitizeText(adminNotes) : null) : existing.adminNotes,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
  });

  return updated;
}
