import { ZodError } from 'zod';
import type { ApiErrorBody } from './domain';

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} tidak ditemukan`);
export const forbidden = (message = 'Akses ditolak untuk peran Anda saat ini.') =>
  new AppError(403, 'FORBIDDEN', message);
export const badRequest = (message: string) => new AppError(400, 'BAD_REQUEST', message);

// Single translation point for every error that crosses the server boundary
export function toErrorBody(e: unknown): ApiErrorBody {
  if (e instanceof AppError) return { status: e.status, code: e.code, message: e.message };
  if (e instanceof ZodError) {
    const flat = e.flatten();
    const first = flat.formErrors[0] ?? Object.values(flat.fieldErrors).flat()[0];
    return { status: 400, code: 'VALIDATION', message: first ?? 'Input tidak valid', fields: flat.fieldErrors };
  }
  const code = (e as { code?: string })?.code;
  if (code === 'ER_DUP_ENTRY') return { status: 409, code: 'CONFLICT', message: 'Data sudah ada (duplikat).' };
  if (code === 'ECONNREFUSED' || code === 'ER_ACCESS_DENIED_ERROR' || code === 'PROTOCOL_CONNECTION_LOST') {
    return { status: 503, code: 'DB_UNAVAILABLE', message: 'Database MariaDB tidak dapat dihubungi.' };
  }
  console.error('[nexusflow] unexpected error:', e);
  return { status: 500, code: 'INTERNAL', message: 'Terjadi kesalahan internal pada server.' };
}
