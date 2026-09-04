import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/prisma';
import { logger } from './utils/logger';

let server: Server | undefined;
let shuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down gracefully...');

  const forceExit = setTimeout(() => {
    logger.fatal('Shutdown timed out after 15s, forcing exit');
    process.exit(1);
  }, 15_000);
  forceExit.unref();

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('HTTP server closed');
    }
    await disconnectDatabase();

    // Pino writes through a worker thread when a transport is configured
    // (pino-pretty in development). Calling process.exit() without flushing
    // discards whatever is still buffered - which is exactly the shutdown
    // diagnostics you most need when investigating a bad deploy.
    await new Promise<void>((resolve) => {
      logger.flush(() => resolve());
      setTimeout(resolve, 200).unref();
    });

    clearTimeout(forceExit);
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
};

const bootstrap = async (): Promise<void> => {
  await connectDatabase();
  const app = createApp();
  server = app.listen(env.PORT, () => {
    logger.info(`API listening on port ${env.PORT} [${env.NODE_ENV}]`);
  });
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection');
  void shutdown('unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  void shutdown('uncaughtException');
});

void bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
