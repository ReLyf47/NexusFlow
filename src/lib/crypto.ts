// AES-256-GCM for secrets at rest (workspace LLM API keys, FR-AI-03).
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const key = () =>
  createHash('sha256')
    .update(`${process.env.AUTH_SECRET ?? 'nexusflow-dev-only-secret-change-me'}:llm-api-key`)
    .digest();

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

// Returns null when the secret cannot be decrypted (e.g. AUTH_SECRET rotated)
export function decryptSecret(stored: string | null): string | null {
  if (!stored) return null;
  try {
    const [, iv, tag, data] = stored.split(':');
    const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
