import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env, isProduction } from './config/env';
import { logger } from './utils/logger';
import { mountSwagger } from './config/swagger';
import apiRoutes from './routes';
import { requestId } from './middleware/requestId';
import { globalLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { ForbiddenError } from './utils/ApiError';

export const createApp = (): Express => {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(pinoHttp({
    logger,
    genReqId: (_req, res) => (res.getHeader('X-Request-Id') as string) ?? '',
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
  }));

  app.use(helmet({
    contentSecurityPolicy: isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", env.CLIENT_ORIGIN, 'https://api.stripe.com'],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    } : false,
    crossOriginEmbedderPolicy: false,
    hsts: isProduction ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  const allowedOrigins = new Set(
    [env.CLIENT_ORIGIN, isProduction ? null : 'http://localhost:5173'].filter((o): o is string => Boolean(o)),
  );

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) { callback(null, true); return; }
      logger.warn({ origin }, 'Blocked by CORS');
      callback(new ForbiddenError('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'RateLimit'],
    maxAge: 86_400,
  }));

  app.use('/api/v1/payments/stripe/webhook', express.raw({ type: 'application/json' }));

  app.use(express.json({
    limit: '1mb',
    verify: (req, _res, buf) => { (req as express.Request).rawBody = buf; },
  }));

  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api', globalLimiter);

  mountSwagger(app);
  app.use('/api/v1', apiRoutes);

  app.get('/', (_req, res) => {
    res.json({
      name: 'Multi-Vendor Tech Asset Marketplace API', version: '1.0.0',
      docs: `${env.SERVER_ORIGIN}/api/docs`, health: `${env.SERVER_ORIGIN}/api/v1/health`,
    });
  });

  app.use(notFound);
  app.use(errorHandler);
  return app;
};
