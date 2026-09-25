import type { Request, Response } from 'express';
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

export const getDiagnostic = async (_req: Request, res: Response): Promise<void> => {
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

  let resendApiVerification: { ok: boolean; status?: number; error?: string } | null = null;
  if (resendApiKeyStatus === 'PRESENT') {
    try {
      const probe = await fetch('https://api.resend.com/api-keys', {
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'User-Agent': 'AssetHub-Marketplace/1.0',
        },
      });
      resendApiVerification = { ok: probe.ok, status: probe.status };
      if (!probe.ok) {
        const errBody = await probe.json().catch(() => ({}));
        resendApiVerification.error =
          (errBody as any)?.message || `Resend responded with HTTP ${probe.status}`;
      }
    } catch (err: any) {
      resendApiVerification = { ok: false, error: err?.message || String(err) };
    }
  }

  sendSuccess(
    res,
    {
      resendApiKeyStatus,
      configuredSupportEmail: supportEmail,
      configuredFromEmail: fromEmail,
      resendApiVerification,
      runtimeNodeEnv: process.env.NODE_ENV,
      serverUptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    'Contact notification diagnostic status',
    200,
  );
};
