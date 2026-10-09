import { createHash } from 'node:crypto';

// The prefix tells an API token from a session JWT before any lookup, and
// makes a leaked one recognisable to secret scanners.
export const API_TOKEN_PREFIX = 'mxk_';

export function isApiToken(credential: string): boolean {
  return credential.startsWith(API_TOKEN_PREFIX);
}

export function hashApiToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
