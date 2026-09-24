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
