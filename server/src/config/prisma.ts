import { PrismaClient } from '@prisma/client';
import { isDevelopment } from './env';
import { logger } from '../utils/logger';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * WHY every log level is emitted as an EVENT rather than to stdout:
 *
 * Prisma's built-in `stdout` writer bypasses our pino logger entirely. That has
 * three consequences that matter in production:
 *
 *  1. Output is unstructured text, so it breaks JSON log ingestion.
 *  2. It carries no requestId, so errors cannot be correlated with a request.
 *  3. It logs EXPECTED errors at ERROR level. The most important example here:
 *     our webhook idempotency guard deliberately INSERTs a PaymentEvent and
 *     catches the P2002 unique-constraint violation to detect a duplicate
 *     delivery. That is the mechanism working correctly, but Prisma reports it
 *     as an error - so a payment gateway's normal retry traffic would wake an
 *     on-call engineer. Routing through pino lets us demote those.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'warn' },
      { emit: 'event', level: 'error' },
    ],
  });

globalForPrisma.prisma = prisma;

/**
 * Errors that are a normal part of a control flow we implement on purpose.
 * They are still logged - at debug - so they remain diagnosable, but they do not
 * pollute error dashboards or alerting.
 */
const isExpectedControlFlowError = (message: string): boolean =>
  // Idempotency guard: duplicate webhook/IPN delivery.
  message.includes('Unique constraint failed') ||
  // Optimistic concurrency: the retry wrapper handles and retries these.
  message.includes('could not serialize') ||
  message.includes('40001');

prisma.$on('error' as never, (e: { message: string; target?: string }) => {
  if (isExpectedControlFlowError(e.message)) {
    logger.debug({ target: e.target }, 'Expected Prisma constraint/serialization event');
    return;
  }
  logger.error({ target: e.target, err: e.message }, 'Prisma error');
});

prisma.$on('warn' as never, (e: { message: string; target?: string }) => {
  logger.warn({ target: e.target, msg: e.message }, 'Prisma warning');
});

if (isDevelopment) {
  prisma.$on('query' as never, (e: { query: string; duration: number }) => {
    if (e.duration > 200) logger.warn({ durationMs: e.duration, query: e.query }, 'Slow query');
  });
}

export const connectDatabase = async (): Promise<void> => {
  await prisma.$connect();
  logger.info('PostgreSQL connected');
};
export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  logger.info('PostgreSQL disconnected');
};
