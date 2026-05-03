import bcrypt from 'bcryptjs';
import { env } from './env';

export async function hashPassword(plain: string) {
  const rounds = Number(env.BCRYPT_ROUNDS);
  return bcrypt.hash(plain, rounds);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
