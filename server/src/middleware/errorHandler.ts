import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { isProduction } from '../config/env';

interface ErrorBody {
  success: false; message: string; code: string;
  requestId?: string; details?: unknown; stack?: string;
}

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let details: unknown;
  let isOperational = false;

  if (err instanceof ApiError) {
    statusCode = err.statusCode; message = err.message; code = err.code;
    details = err.details; isOperational = err.isOperational;
  } else if (err instanceof ZodError) {
    statusCode = 422; code = 'VALIDATION_ERROR'; message = 'Validation failed';
    details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    isOperational = true;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    isOperational = true;
    switch (err.code) {
      case 'P2002': {
        statusCode = 409; code = 'CONFLICT';
        const target = (err.meta?.target as string[] | undefined)?.join(', ');
        message = target ? `A record with this ${target} already exists` : 'Record already exists';
        break;
      }
      case 'P2025': statusCode = 404; code = 'NOT_FOUND'; message = 'The requested record does not exist'; break;
      case 'P2003': statusCode = 409; code = 'FOREIGN_KEY_CONSTRAINT'; message = 'Related record is missing or still referenced'; break;
      case 'P2034': statusCode = 409; code = 'TRANSACTION_CONFLICT'; message = 'Concurrent update detected, please retry'; break;
      /**
       * P2010 is "raw query failed" and carries the SQLSTATE in its message.
       * Serialization failures (40001) and deadlocks (40P01) are transient and
       * the caller's correct response is to retry - so they must not be
       * reported as a generic 400/500. Services retry these internally; this
       * branch is the safety net for any path that does not.
       */
      case 'P2010': {
        const raw = err.message;
        if (raw.includes('40001') || raw.includes('40P01') || raw.includes('could not serialize')) {
          statusCode = 409; code = 'TRANSACTION_CONFLICT';
          message = 'Concurrent update detected, please retry';
        } else {
          statusCode = 400; code = 'RAW_QUERY_FAILED'; message = 'Database request failed';
        }
        break;
      }
      default: statusCode = 400; code = `PRISMA_${err.code}`; message = 'Database request failed';
    }
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400; code = 'DB_VALIDATION_ERROR'; message = 'Invalid database query'; isOperational = true;
  } else if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400; code = 'MALFORMED_JSON'; message = 'Request body is not valid JSON'; isOperational = true;
  } else if (err instanceof Error) {
    message = err.message;
  }

  const logPayload = {
    requestId: req.requestId, method: req.method, path: req.originalUrl,
    statusCode, code, userId: req.user?.id, err,
  };

  if (!isOperational || statusCode >= 500) logger.error(logPayload, 'Unhandled error');
  else logger.warn(logPayload, 'Handled error');

  const body: ErrorBody = {
    success: false,
    message: isProduction && !isOperational ? 'Internal server error' : message,
    code, requestId: req.requestId,
  };
  if (details !== undefined) body.details = details;
  if (!isProduction && err instanceof Error) body.stack = err.stack;

  res.status(statusCode).json(body);
};
