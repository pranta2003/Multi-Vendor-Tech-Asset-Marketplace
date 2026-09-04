import path from 'node:path';
import swaggerJsdoc from 'swagger-jsdoc';
import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { env, isProduction } from './env';
import { logger } from '../utils/logger';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Multi-Vendor Tech Asset Marketplace API',
      version: '1.0.0',
      description: [
        'REST API for a multi-vendor marketplace selling digital tech assets.',
        '',
        '### Authentication',
        'Two tokens with deliberately different lifetimes and storage:',
        '',
        '- **Access token** - short lived, returned in the JSON body, sent as',
        '  `Authorization: Bearer <token>`. The client keeps it in memory only.',
        '- **Refresh token** - long lived, returned **exclusively** as an',
        '  `HttpOnly` cookie named `refresh_token`. It is never present in a',
        '  response body, so JavaScript cannot read it and an XSS cannot steal a',
        '  long-lived credential.',
        '',
        'The cookie is scoped to `Path=/api/v1/auth`, so it is not attached to',
        'ordinary API calls - it only travels to the endpoints that actually need',
        'it, which shrinks its exposure and its CSRF surface.',
        '',
        '### Refresh token rotation',
        '`POST /auth/refresh` invalidates the token it consumed and issues a new',
        'one. Presenting an already-consumed token is treated as a replay of a',
        'stolen credential and **revokes the entire token family**. Clients must',
        'therefore serialise refreshes: two concurrent refresh calls look',
        'identical to theft and will log the user out.',
        '',
        '### Response envelope',
        'Every response uses a fixed envelope, so clients need exactly one',
        'success path and one error path. Errors carry a stable machine-readable',
        '`code` plus a `requestId` for log correlation.',
        '',
        '### Money',
        'All amounts are **integers in the currency minor unit** (poisha for BDT,',
        'cents for USD). Floats are never used for money.',
      ].join('\n'),
      license: { name: 'MIT' },
    },
    servers: [{ url: `${env.SERVER_ORIGIN}/api/v1`, description: env.NODE_ENV }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        /**
         * Documented so Swagger UI shows the cookie requirement on /auth/refresh
         * and /auth/logout. It is declarative only: browsers attach HttpOnly
         * cookies automatically and Swagger UI cannot set one, which is exactly
         * the property that makes the token safe from script access.
         */
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'refresh_token' },
      },
      schemas: {
        Role: { type: 'string', enum: ['ADMIN', 'VENDOR', 'CUSTOMER'] },

        PublicUser: {
          type: 'object',
          description:
            'The only user shape ever returned. Deliberately excludes passwordHash and every other internal column.',
          required: ['id', 'email', 'fullName', 'role', 'isEmailVerified', 'createdAt'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email', example: 'buyer@example.com' },
            fullName: { type: 'string', example: 'Pranta Kumer Pandit' },
            role: { $ref: '#/components/schemas/Role' },
            avatarUrl: { type: 'string', nullable: true },
            isEmailVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },

        AuthPayload: {
          type: 'object',
          description:
            'Note what is absent: the refresh token. It is delivered only as an HttpOnly cookie.',
          required: ['user', 'accessToken', 'expiresIn'],
          properties: {
            user: { $ref: '#/components/schemas/PublicUser' },
            accessToken: { type: 'string', description: 'JWT. Hold in memory; never persist to localStorage.' },
            expiresIn: { type: 'integer', description: 'Access token lifetime in seconds.', example: 900 },
          },
        },

        ErrorBody: {
          type: 'object',
          required: ['success', 'message', 'code', 'requestId'],
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', description: 'Safe to display to an end user.' },
            code: {
              type: 'string',
              description: 'Stable identifier for programmatic branching. Never parse `message`.',
              example: 'UNAUTHORIZED',
            },
            requestId: { type: 'string', description: 'Correlates this response with server logs.' },
            details: { type: 'object', nullable: true, additionalProperties: true },
            stack: { type: 'string', description: 'Development only. Never emitted in production.' },
          },
        },

        ValidationErrorBody: {
          allOf: [
            { $ref: '#/components/schemas/ErrorBody' },
            {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                details: {
                  type: 'array',
                  description: 'One entry per failed field, suitable for inline form errors.',
                  items: {
                    type: 'object',
                    properties: {
                      field: { type: 'string', example: 'password' },
                      message: { type: 'string', example: 'Must contain an uppercase letter' },
                      code: { type: 'string', example: 'invalid_string' },
                    },
                  },
                },
              },
            },
          ],
        },
      },
      responses: {
        ValidationFailed: {
          description: 'Request body failed schema validation.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ValidationErrorBody' } } },
        },
        Unauthorized: {
          description: 'Missing, malformed, expired, or revoked credentials.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } },
        },
        Forbidden: {
          description: 'Authenticated, but this role may not perform the action.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } },
        },
        NotFound: {
          description: 'Resource does not exist, or is not visible to this caller.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } },
        },
        Conflict: {
          description: 'The request conflicts with current state.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } },
        },
        RateLimited: {
          description: 'Rate limit exceeded. Inspect the `RateLimit-*` response headers.',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorBody' } } },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Health', description: 'Liveness and readiness probes.' },
      { name: 'Auth', description: 'Registration, login, token rotation, and session revocation.' },
      { name: 'Catalog', description: 'Public product browsing and vendor product management.' },
      { name: 'Cart', description: 'Server-authoritative cart. Prices are never accepted from the client.' },
      { name: 'Orders', description: 'Checkout, order history, and purchased-licence entitlements.' },
      { name: 'Payments', description: 'Gateway callbacks and payment status. Fulfilment happens here, not on redirect.' },
    ],
  },
  /**
   * Both .ts and .js are globbed so the docs are identical whether the app runs
   * from source via tsx or from the compiled dist/ output in a container.
   *
   * `routes/` is included as well as `modules/`: the health probe lives in the
   * top-level router, and while the glob covered only `modules/**` it was
   * silently omitted from the spec - swagger-jsdoc cannot warn about a file it
   * was never pointed at.
   */
  apis: [
    path.join(__dirname, '../modules/**/*.routes.ts'),
    path.join(__dirname, '../modules/**/*.routes.js'),
    path.join(__dirname, '../routes/*.ts'),
    path.join(__dirname, '../routes/*.js'),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

export const mountSwagger = (app: Express): void => {
  if (isProduction && process.env.ENABLE_SWAGGER_UI !== 'true') {
    logger.info('Swagger UI disabled in production');
    return;
  }
  app.get('/api/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Marketplace API Docs',
    swaggerOptions: { persistAuthorization: true, docExpansion: 'none' },
  }));
  logger.info(`Swagger UI -> ${env.SERVER_ORIGIN}/api/docs`);
};
