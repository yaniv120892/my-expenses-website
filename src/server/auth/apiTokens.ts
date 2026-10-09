import { AuthError } from '@/server/auth/session';
import {
  hashApiToken,
  isAuthenticApiToken,
} from '@/server/auth/apiTokenFormat';
import { HttpError } from '@/server/http/errors';
import { apiTokenRepository } from '@/server/repositories/apiTokenRepository';
import logger from '@/server/logging/logger';
import type { ApiTokenScope } from '@/shared/types/apiToken';

// Settings shows last use by the day, so a script polling every few seconds
// writes it once rather than on every request.
const LAST_USED_RESOLUTION_MS = 60 * 60 * 1000;

export type ApiTokenIdentity = { userId: string; apiTokenId: string };

export async function authenticateApiToken(
  token: string,
  requiredScope: ApiTokenScope,
): Promise<ApiTokenIdentity> {
  if (!isAuthenticApiToken(token)) {
    throw new AuthError('INVALID_API_TOKEN', 'Invalid API token');
  }
  const record = await apiTokenRepository.findByHash(hashApiToken(token));
  if (!record) {
    throw new AuthError('INVALID_API_TOKEN', 'Invalid API token');
  }
  const now = new Date();
  if (record.expiresAt <= now) {
    throw new AuthError('API_TOKEN_EXPIRED', 'API token expired');
  }
  if (!record.scopes.includes(requiredScope)) {
    throw new HttpError(
      403,
      `This API token does not have the ${requiredScope} scope`,
    );
  }
  const isUseStale =
    !record.lastUsedAt ||
    now.getTime() - record.lastUsedAt.getTime() >= LAST_USED_RESOLUTION_MS;
  if (isUseStale) {
    await recordUse(record.id, now);
  }
  return { userId: record.userId, apiTokenId: record.id };
}

async function recordUse(id: string, usedAt: Date): Promise<void> {
  try {
    await apiTokenRepository.markUsed(id, usedAt);
  } catch (err) {
    logger.warn({ err, apiTokenId: id }, 'Failed to record API token use');
  }
}
