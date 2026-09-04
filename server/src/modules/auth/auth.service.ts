import { Prisma, Role, VendorStatus, type User } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { hashPassword, verifyPassword } from '../../utils/password';
import { hashToken, newUuid, signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { logger } from '../../utils/logger';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../../utils/ApiError';
import type { ChangePasswordInput, LoginInput, RegisterInput } from './auth.validation';

export interface ClientMeta { userAgent?: string; ipAddress?: string; }

export interface PublicUser {
  id: string; email: string; fullName: string; role: Role;
  avatarUrl: string | null; isEmailVerified: boolean; createdAt: Date;
}

export interface AuthResult {
  user: PublicUser; accessToken: string; refreshToken: string; refreshExpiresAt: Date;
}

const toPublicUser = (u: User): PublicUser => ({
  id: u.id, email: u.email, fullName: u.fullName, role: u.role,
  avatarUrl: u.avatarUrl, isEmailVerified: u.isEmailVerified, createdAt: u.createdAt,
});

const parseDuration = (value: string): number => {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) throw new Error(`Unparseable duration: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  const multipliers: Record<string, number> = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * (multipliers[unit] ?? 1_000);
};

export const REFRESH_TTL_MS = parseDuration(env.JWT_REFRESH_EXPIRES_IN);
export const ACCESS_TTL_MS = parseDuration(env.JWT_ACCESS_EXPIRES_IN);

const issueTokenPair = async (
  user: User, familyId: string, meta: ClientMeta, tx: Prisma.TransactionClient = prisma,
): Promise<Pick<AuthResult, 'accessToken' | 'refreshToken' | 'refreshExpiresAt'>> => {
  const jti = newUuid();
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id, jti, fid: familyId });
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await tx.refreshToken.create({
    data: {
      userId: user.id, tokenHash: hashToken(refreshToken), familyId, expiresAt: refreshExpiresAt,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
    },
  });
  return { accessToken, refreshToken, refreshExpiresAt };
};

export const register = async (input: RegisterInput, meta: ClientMeta): Promise<AuthResult> => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError('An account with this email already exists');

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email, passwordHash, fullName: input.fullName,
        phone: input.phone ?? null, role: input.role,
      },
    });
    if (input.role === Role.VENDOR && input.storeName) {
      const slug = input.storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
      await tx.vendorProfile.create({
        data: { userId: created.id, storeName: input.storeName, slug: `${slug}-${created.id.slice(0, 6)}`, status: VendorStatus.PENDING },
      });
    }
    await tx.cart.create({ data: { userId: created.id } });
    return created;
  });

  const tokens = await issueTokenPair(user, newUuid(), meta);
  logger.info({ userId: user.id, role: user.role }, 'User registered');
  return { user: toPublicUser(user), ...tokens };
};

export const login = async (input: LoginInput, meta: ClientMeta): Promise<AuthResult> => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.passwordHash) {
    await hashPassword('timing-attack-mitigation-dummy-value');
    throw new UnauthorizedError('Invalid email or password');
  }
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) throw new UnauthorizedError('Invalid email or password');
  if (!user.isActive || user.deletedAt) throw new ForbiddenError('This account has been deactivated');

  const tokens = await issueTokenPair(user, newUuid(), meta);
  logger.info({ userId: user.id }, 'User logged in');
  return { user: toPublicUser(user), ...tokens };
};

export const refresh = async (rawToken: string, meta: ClientMeta): Promise<AuthResult> => {
  const payload = verifyRefreshToken(rawToken);
  const tokenHash = hashToken(rawToken);

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!stored) {
    logger.warn({ userId: payload.sub, fid: payload.fid }, 'Unknown refresh token');
    throw new UnauthorizedError('Invalid refresh token');
  }

  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { familyId: stored.familyId, revokedAt: null }, data: { revokedAt: new Date() },
    });
    logger.error({ userId: stored.userId, familyId: stored.familyId }, 'Refresh token reuse detected - family revoked');
    throw new UnauthorizedError('Session compromised. Please log in again.');
  }

  if (stored.expiresAt <= new Date()) throw new UnauthorizedError('Refresh token expired');

  const user = stored.user;
  if (!user.isActive || user.deletedAt) throw new ForbiddenError('This account has been deactivated');
  if (user.credentialsChangedAt > stored.createdAt) throw new UnauthorizedError('Credentials changed. Please log in again.');

  const tokens = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return issueTokenPair(user, stored.familyId, meta, tx);
  });

  return { user: toPublicUser(user), ...tokens };
};

export const logout = async (rawToken?: string): Promise<void> => {
  if (!rawToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(rawToken), revokedAt: null }, data: { revokedAt: new Date() },
  });
};

export const logoutAll = async (userId: string): Promise<number> => {
  const result = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null }, data: { revokedAt: new Date() },
  });
  return result.count;
};

export const getMe = async (userId: string): Promise<PublicUser> => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return toPublicUser(user);
};

export const changePassword = async (userId: string, input: ChangePasswordInput): Promise<void> => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.passwordHash) throw new ForbiddenError('Account has no password set');
  const ok = await verifyPassword(user.passwordHash, input.currentPassword);
  if (!ok) throw new UnauthorizedError('Current password is incorrect');
  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash, credentialsChangedAt: new Date() } });
    await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  });
  logger.info({ userId }, 'Password changed; all sessions revoked');
};

export const pruneExpiredTokens = async (): Promise<number> => {
  const { count } = await prisma.refreshToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: new Date(Date.now() - 30 * 86_400_000) } }] },
  });
  return count;
};
