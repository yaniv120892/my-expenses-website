import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';
import { AuthError, extractBearerToken } from '@/server/auth/session';
import { importTokenRepository } from '@/server/repositories/importTokenRepository';
import logger from '@/server/logging/logger';

// The prefix tells an import token from a session JWT before any lookup, and
// makes a leaked one recognisable to secret scanners.
export const IMPORT_TOKEN_PREFIX = 'mxi_';

// Settings shows last use by the day, so a statement run polling every few
// seconds writes it once rather than on every request.
const LAST_USED_RESOLUTION_MS = 60 * 60 * 1000;

export function hashImportToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function bearerImportToken(req: NextRequest): string | null {
  const bearer = extractBearerToken(req);
  return bearer?.startsWith(IMPORT_TOKEN_PREFIX) ? bearer : null;
}

export async function authenticateImportToken(token: string): Promise<string> {
  const record = await importTokenRepository.findByHash(hashImportToken(token));
  if (!record) {
    throw new AuthError('INVALID_IMPORT_TOKEN', 'Invalid import token');
  }
  const now = new Date();
  if (record.expiresAt <= now) {
    throw new AuthError('IMPORT_TOKEN_EXPIRED', 'Import token expired');
  }
  const isUseStale =
    !record.lastUsedAt ||
    now.getTime() - record.lastUsedAt.getTime() >= LAST_USED_RESOLUTION_MS;
  if (isUseStale) {
    await recordUse(record.id, now);
  }
  return record.userId;
}

async function recordUse(id: string, usedAt: Date): Promise<void> {
  try {
    await importTokenRepository.markUsed(id, usedAt);
  } catch (err) {
    logger.warn(
      { err, importTokenId: id },
      'Failed to record import token use',
    );
  }
}
