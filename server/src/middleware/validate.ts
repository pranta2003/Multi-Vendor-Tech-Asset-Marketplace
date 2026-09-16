import type { NextFunction, Request, Response } from 'express';
import { ZodError, type AnyZodObject } from 'zod';
import { ValidationError } from '../utils/ApiError';

export const validate =
  (schema: AnyZodObject) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse({ body: req.body, query: req.query, params: req.params });
      if (parsed.body !== undefined) req.body = parsed.body;
      if (parsed.query !== undefined) Object.assign(req.query, parsed.query);
      if (parsed.params !== undefined) Object.assign(req.params, parsed.params);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map((i) => ({
          field: i.path.slice(1).join('.') || i.path.join('.'),
          message: i.message,
          code: i.code,
        }));
        const summary = details.map((d) => d.message).filter(Boolean).join('. ');
        next(new ValidationError(summary || 'Request validation failed', details));
        return;
      }
      next(err);
    }
  };
