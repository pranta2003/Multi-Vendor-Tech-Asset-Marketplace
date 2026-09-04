import pino from 'pino';
import { env, isProduction } from '../config/env';

export const logger = pino({
  level: isProduction ? 'info' : 'debug',
  base: { service: 'marketplace-api', env: env.NODE_ENV },
  redact: {
    paths: [
      'req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]',
      '*.password', '*.passwordHash', '*.refreshToken', '*.accessToken',
      '*.tokenHash', '*.store_passwd', '*.STRIPE_SECRET_KEY',
    ],
    censor: '[REDACTED]',
  },
  ...(isProduction ? {} : {
    transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
  }),
});
