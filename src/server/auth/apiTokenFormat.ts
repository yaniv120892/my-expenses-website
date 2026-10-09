import { createHash, createHmac, randomBytes } from 'node:crypto';
import { requireEnv } from '@/server/env';
import { secretsEqual } from '@/server/utils/webhookAuth';

// The prefix tells an API token from a session JWT before any lookup, and
// makes a leaked one recognisable to secret scanners.
export const API_TOKEN_PREFIX = 'mxk_';

// A keyed suffix lets a forged token be refused without a database lookup,
// as a forged session JWT is. Rotating JWT_SECRET invalidates every token.
const SIGNATURE_LENGTH = 16;

export function mintApiToken(): string {
  const body = randomBytes(32).toString('base64url');
  return `${API_TOKEN_PREFIX}${body}${sign(body)}`;
}

export function isApiToken(credential: string): boolean {
  return credential.startsWith(API_TOKEN_PREFIX);
}

export function isAuthenticApiToken(token: string): boolean {
  const body = token.slice(API_TOKEN_PREFIX.length, -SIGNATURE_LENGTH);
  const signature = token.slice(-SIGNATURE_LENGTH);
  return body.length > 0 && secretsEqual(signature, sign(body));
}

export function hashApiToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function sign(body: string): string {
  return createHmac('sha256', requireEnv('JWT_SECRET'))
    .update(`api-token:${body}`)
    .digest('base64url')
    .slice(0, SIGNATURE_LENGTH);
}
