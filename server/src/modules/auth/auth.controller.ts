import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/ApiResponse';
import { UnauthorizedError } from '../../utils/ApiError';
import * as authService from './auth.service';
import { ACCESS_TTL_MS, REFRESH_TTL_MS } from './auth.service';

const REFRESH_COOKIE = 'refresh_token';

const refreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAME_SITE,
  domain: env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN,
  path: '/api/v1/auth',
  maxAge: REFRESH_TTL_MS,
});

const clientMeta = (req: Request): authService.ClientMeta => ({
  userAgent: req.get('user-agent') ?? undefined,
  ipAddress: req.ip,
});

const respondWithAuth = (res: Response, result: authService.AuthResult, message: string, statusCode = 200): void => {
  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions());
  sendSuccess(res, {
    user: result.user, accessToken: result.accessToken,
    expiresIn: Math.floor(ACCESS_TTL_MS / 1000),
  }, message, statusCode);
};

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body, clientMeta(req));
  respondWithAuth(res, result, 'Registration successful', 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body, clientMeta(req));
  respondWithAuth(res, result, 'Login successful');
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!token) throw new UnauthorizedError('Refresh token cookie is missing');
  const result = await authService.refresh(token, clientMeta(req));
  respondWithAuth(res, result, 'Token refreshed');
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined);
  const { maxAge: _omit, ...clearOptions } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, clearOptions);
  sendSuccess(res, null, 'Logged out successfully');
});

export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  const count = await authService.logoutAll(req.user!.id);
  const { maxAge: _omit, ...clearOptions } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, clearOptions);
  sendSuccess(res, { revokedSessions: count }, 'All sessions revoked');
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.id);
  sendSuccess(res, { user }, 'Current user retrieved');
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.changePassword(req.user!.id, req.body);
  const { maxAge: _omit, ...clearOptions } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, clearOptions);
  sendSuccess(res, null, 'Password changed. Please log in again.');
});
