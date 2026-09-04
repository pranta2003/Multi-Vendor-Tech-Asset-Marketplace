import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { TooManyRequestsError } from '../utils/ApiError';

const base = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  handler: (_req: unknown, _res: unknown, next: (e?: unknown) => void) => {
    next(new TooManyRequestsError());
  },
};

export const globalLimiter = rateLimit({ ...base, windowMs: env.RATE_LIMIT_WINDOW_MS, limit: env.RATE_LIMIT_MAX });
export const authLimiter = rateLimit({ ...base, windowMs: env.RATE_LIMIT_WINDOW_MS, limit: env.AUTH_RATE_LIMIT_MAX, skipSuccessfulRequests: true });
export const paymentLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 10 });
