import type { Request, Response } from 'express';
import { Role } from '@prisma/client';
import { sendSuccess } from '../../utils/ApiResponse';
import { UnauthorizedError } from '../../utils/ApiError';
import * as orderService from './order.service';

const requireUser = (req: Request): { id: string; role: Role } => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return { id: req.user.id, role: req.user.role };
};

export const listMine = async (req: Request, res: Response): Promise<void> => {
  const { id } = requireUser(req);
  const { items, meta } = await orderService.listMyOrders(
    id,
    Number(req.query.page ?? 1),
    Number(req.query.limit ?? 10),
  );
  sendSuccess(res, items, 'Orders retrieved', 200, meta);
};

export const detail = async (req: Request, res: Response): Promise<void> => {
  const { id } = requireUser(req);
  const order = await orderService.getMyOrder(id, String(req.params.orderNumber));
  sendSuccess(res, { order }, 'Order retrieved');
};

export const entitlements = async (req: Request, res: Response): Promise<void> => {
  const { id } = requireUser(req);
  const grants = await orderService.listMyEntitlements(id);
  sendSuccess(res, { grants }, 'Entitlements retrieved');
};

export const vendorSales = async (req: Request, res: Response): Promise<void> => {
  const { id, role } = requireUser(req);
  const sales = await orderService.listVendorSales(id, role);
  sendSuccess(res, sales, 'Vendor sales retrieved');
};
