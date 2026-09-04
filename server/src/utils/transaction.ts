import { Prisma } from '@prisma/client';
import { logger } from './logger';
import { ConflictError } from './ApiError';

/**
 * Detects a Postgres serialization / deadlock failure.
 *
 * WHY this is not simply `err.code === 'P2034'`:
 * Prisma reports the same underlying Postgres condition through DIFFERENT error
 * codes depending on how the statement was issued.
 *
 *   - Prisma Client model calls  -> P2034 "Transaction failed due to a write conflict"
 *   - $queryRaw / $executeRaw    -> P2010 "Raw query failed. Code: `40001`"
 *
 * Any code that mixes raw SQL (which we must, for SELECT ... FOR UPDATE) with a
 * Serializable transaction and only checks P2034 will silently never retry, and
 * will leak a raw database error to the client as a 500. That was a real bug in
 * the first draft of this file, caught by the concurrency test.
 *
 * SQLSTATE 40001 = serialization_failure, 40P01 = deadlock_detected. Both are
 * transient by definition and safe to retry.
 */
export const isSerializationFailure = (err: unknown): boolean => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2034') return true;
    if (err.code === 'P2010') {
      const message = err.message;
      return message.includes('40001') || message.includes('40P01') || message.includes('could not serialize');
    }
  }
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    const message = err.message;
    return message.includes('40001') || message.includes('40P01') || message.includes('could not serialize');
  }
  return false;
};

export interface RetryOptions {
  label: string;
  maxAttempts?: number;
  /** Message shown to the user if every attempt loses the race. */
  exhaustedMessage?: string;
}

/**
 * Runs a Serializable transaction with bounded retries and jittered backoff.
 *
 * Postgres does not block conflicting Serializable transactions - it lets both
 * run and aborts the loser at COMMIT. A serialization failure is therefore a
 * NORMAL outcome under concurrency, not an exception to surface. Serializable
 * without a retry loop is broken under load by construction.
 *
 * Jitter matters: fixed backoff makes two colliding transactions retry in
 * lockstep and collide again at the same instant.
 */
export const withSerializableRetry = async <T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> => {
  const maxAttempts = options.maxAttempts ?? 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (!isSerializationFailure(err)) throw err;

      if (attempt === maxAttempts) {
        logger.warn({ label: options.label, attempt }, 'Serialization retries exhausted');
        /**
         * Translate to a 409 rather than letting a raw Prisma error become a
         * 500. Losing a race for the last item in stock is a legitimate business
         * outcome the user can act on ("it just sold out"), not a server fault -
         * and a 500 here would also pollute your error budget/alerting with
         * events that are not actually incidents.
         */
        throw new ConflictError(
          options.exhaustedMessage ??
            'This item is being purchased by several people at once. Please try again.',
        );
      }

      const backoffMs = 25 * attempt + Math.floor(Math.random() * 40);
      logger.warn(
        { label: options.label, attempt, backoffMs },
        'Serialization conflict, retrying transaction',
      );
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  // Unreachable: the loop either returns or throws. Present because TypeScript
  // cannot prove that, and an implicit `undefined` return would be worse.
  throw new ConflictError(options.exhaustedMessage ?? 'Transaction could not be completed');
};
