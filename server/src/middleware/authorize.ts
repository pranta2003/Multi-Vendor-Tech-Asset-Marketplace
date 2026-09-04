import type { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { ForbiddenError, UnauthorizedError } from '../utils/ApiError';

export const authorize =
  (...allowed: Role[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) { next(new UnauthorizedError('Authentication required')); return; }
    if (!allowed.includes(req.user.role)) {
      next(new ForbiddenError(`Requires one of the following roles: ${allowed.join(', ')}`));
      return;
    }
    next();
  };

export const requireAdmin = authorize(Role.ADMIN);
export const requireVendor = authorize(Role.VENDOR, Role.ADMIN);
export const requireCustomer = authorize(Role.CUSTOMER, Role.ADMIN);
