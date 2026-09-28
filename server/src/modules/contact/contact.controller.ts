import type { Request, Response } from 'express';
import { prisma } from '../../config/prisma';
import { sendSuccess } from '../../utils/ApiResponse';
import { UnauthorizedError } from '../../utils/ApiError';
import * as contactService from './contact.service';

export const create = async (req: Request, res: Response): Promise<void> => {
  const ticket = await contactService.createSupportTicket(req.body, req.user?.id);
  sendSuccess(res, ticket, 'Support request received successfully', 201);
};

export const listAll = async (req: Request, res: Response): Promise<void> => {
  const { items, meta } = await contactService.listAllSupportTickets({
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 10),
    status: req.query.status as any,
    inquiryType: req.query.inquiryType as string | undefined,
    search: req.query.search as string | undefined,
  });
  sendSuccess(res, items, 'Support tickets retrieved', 200, meta);
};

export const listMine = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const tickets = await contactService.listUserSupportTickets(req.user.id, req.user.email);
  sendSuccess(res, tickets, 'User support tickets retrieved', 200);
};

export const getById = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError('Authentication required');
  }
  const ticket = await contactService.getSupportTicketById(req.params.id as string, req.user);
  sendSuccess(res, ticket, 'Support ticket retrieved', 200);
};

export const updateStatus = async (req: Request, res: Response): Promise<void> => {
  const updated = await contactService.updateSupportTicketStatus(
    req.params.id as string,
    req.body.status,
    req.body.adminNotes,
  );
  sendSuccess(res, updated, 'Support ticket status updated', 200);
};

export const getDiagnostic = async (req: Request, res: Response): Promise<void> => {
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const supportEmail =
    process.env.SUPPORT_EMAIL?.trim() ||
    process.env.SUPPORT_OWNER_EMAIL?.trim() ||
    'prantakumerpandit@gmail.com';
  const fromEmail =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.SUPPORT_EMAIL_FROM?.trim() ||
    'AssetHub Support <onboarding@resend.dev>';

  let resendApiKeyStatus: 'PRESENT' | 'MISSING' | 'EMPTY' | 'INVALID_FORMAT';
  if (!resendApiKey) {
    resendApiKeyStatus = 'MISSING';
  } else if (resendApiKey.length === 0) {
    resendApiKeyStatus = 'EMPTY';
  } else if (!resendApiKey.startsWith('re_') || resendApiKey.length < 10) {
    resendApiKeyStatus = 'INVALID_FORMAT';
  } else {
    resendApiKeyStatus = 'PRESENT';
  }

  // Look up recent support tickets from PostgreSQL to trace real production submissions
  let recentTickets: any[] = [];
  try {
    await contactService.ensureSupportSchema();
    const queryTicketNumber = (req.query.ticketNumber as string)?.trim();
    if (queryTicketNumber) {
      const single = await prisma.supportTicket.findUnique({
        where: { ticketNumber: queryTicketNumber },
        select: {
          id: true,
          ticketNumber: true,
          email: true,
          subject: true,
          inquiryType: true,
          status: true,
          adminNotes: true,
          createdAt: true,
        },
      });
      if (single) recentTickets = [single];
    } else {
      recentTickets = await prisma.supportTicket.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          ticketNumber: true,
          email: true,
          subject: true,
          inquiryType: true,
          status: true,
          adminNotes: true,
          createdAt: true,
        },
      });
    }
  } catch (err: any) {
    recentTickets = [{ error: err?.message || String(err) }];
  }

  // Extract Resend email ID from target or recent ticket's adminNotes
  let targetEmailId = (req.query.emailId as string)?.trim();
  if (!targetEmailId && recentTickets.length > 0) {
    for (const t of recentTickets) {
      if (t.adminNotes) {
        const match = t.adminNotes.match(/ID:\s*([a-zA-Z0-9_-]+)/);
        if (match) {
          targetEmailId = match[1];
          break;
        }
      }
    }
  }

  // Query Resend API for email delivery status if an email ID is identified
  let resendEmailDetails: any = null;
  if (targetEmailId && resendApiKeyStatus === 'PRESENT') {
    try {
      const emailRes = await fetch(`https://api.resend.com/emails/${targetEmailId}`, {
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'User-Agent': 'AssetHub-Marketplace/1.0',
        },
      });
      if (emailRes.ok) {
        resendEmailDetails = await emailRes.json();
      } else {
        const errBody = await emailRes.json().catch(() => ({}));
        resendEmailDetails = {
          httpStatus: emailRes.status,
          error: (errBody as any)?.message || `HTTP ${emailRes.status}`,
        };
      }
    } catch (err: any) {
      resendEmailDetails = { error: err?.message || String(err) };
    }
  }

  // Optional active send probe
  let sendProbeResult: any = null;
  if (req.query.probe === 'true' && resendApiKeyStatus === 'PRESENT') {
    try {
      const probeRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
          'User-Agent': 'AssetHub-Marketplace/1.0',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [supportEmail],
          subject: 'AssetHub Production Support Email Delivery Probe',
          text: `This is an automated production delivery diagnostic test sent to ${supportEmail} at ${new Date().toISOString()}.`,
        }),
      });

      const body = await probeRes.json().catch(() => ({}));
      sendProbeResult = {
        httpStatus: probeRes.status,
        ok: probeRes.ok,
        body,
      };
    } catch (err: any) {
      sendProbeResult = { error: err?.message || String(err) };
    }
  }

  sendSuccess(
    res,
    {
      resendApiKeyStatus,
      configuredSupportEmail: supportEmail,
      configuredFromEmail: fromEmail,
      recentTickets,
      targetEmailId,
      resendEmailDetails,
      sendProbeResult,
      runtimeNodeEnv: process.env.NODE_ENV,
      serverUptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    'Contact notification diagnostic status',
    200,
  );
};
