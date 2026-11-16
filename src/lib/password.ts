import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12; // NFR-SEC-01: >= 10 salt rounds

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_ROUNDS);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);
