import argon2 from 'argon2';

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1,
};

export const hashPassword = (plain: string): Promise<string> => argon2.hash(plain, ARGON2_OPTIONS);

export const verifyPassword = async (digest: string, plain: string): Promise<boolean> => {
  try { return await argon2.verify(digest, plain); } catch { return false; }
};
