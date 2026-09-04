import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';
import { UnauthorizedError } from './ApiError';

export interface AccessTokenPayload { sub: string; email: string; role: Role; type: 'access'; }
export interface RefreshTokenPayload { sub: string; jti: string; fid: string; type: 'refresh'; }

const ISSUER = 'tech-asset-marketplace';
const AUDIENCE = 'tech-asset-marketplace-client';

const accessExpiry = env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'];
const refreshExpiry = env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'];

export const signAccessToken = (payload: Omit<AccessTokenPayload, 'type'>): string =>
  jwt.sign({ ...payload, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: accessExpiry, issuer: ISSUER, audience: AUDIENCE, algorithm: 'HS256',
  });

export const signRefreshToken = (payload: Omit<RefreshTokenPayload, 'type'>): string =>
  jwt.sign({ ...payload, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: refreshExpiry, issuer: ISSUER, audience: AUDIENCE, algorithm: 'HS256',
  });

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'],
    }) as AccessTokenPayload;
    if (decoded.type !== 'access') throw new UnauthorizedError('Invalid token type');
    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw new UnauthorizedError('Access token expired');
    throw new UnauthorizedError('Invalid access token');
  }
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'],
    }) as RefreshTokenPayload;
    if (decoded.type !== 'refresh') throw new UnauthorizedError('Invalid token type');
    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw new UnauthorizedError('Refresh token expired');
    throw new UnauthorizedError('Invalid refresh token');
  }
};

export const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');
export const newUuid = (): string => crypto.randomUUID();
