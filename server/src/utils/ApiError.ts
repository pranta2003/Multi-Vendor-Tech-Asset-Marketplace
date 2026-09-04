export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, code = 'ERROR', details?: unknown, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}
export class BadRequestError extends ApiError { constructor(message = 'Bad request', details?: unknown) { super(400, message, 'BAD_REQUEST', details); } }
export class ValidationError extends ApiError { constructor(message = 'Validation failed', details?: unknown) { super(422, message, 'VALIDATION_ERROR', details); } }
export class UnauthorizedError extends ApiError { constructor(message = 'Authentication required') { super(401, message, 'UNAUTHORIZED'); } }
export class ForbiddenError extends ApiError { constructor(message = 'You do not have permission to perform this action') { super(403, message, 'FORBIDDEN'); } }
export class NotFoundError extends ApiError { constructor(resource = 'Resource') { super(404, `${resource} not found`, 'NOT_FOUND'); } }
export class ConflictError extends ApiError { constructor(message = 'Resource already exists', details?: unknown) { super(409, message, 'CONFLICT', details); } }
export class TooManyRequestsError extends ApiError { constructor(message = 'Too many requests, please try again later') { super(429, message, 'RATE_LIMITED'); } }
export class PaymentError extends ApiError { constructor(message = 'Payment could not be processed', details?: unknown) { super(402, message, 'PAYMENT_FAILED', details); } }
export class InternalError extends ApiError { constructor(message = 'Internal server error') { super(500, message, 'INTERNAL_ERROR', undefined, false); } }
