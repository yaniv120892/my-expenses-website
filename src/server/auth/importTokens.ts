import { createHash, randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { AuthError } from '@/server/auth/session';
import { importTokenRepository } from '@/server/repositories/importTokenRepository';
import logger from '@/server/logging/logger';
import type {
  CreatedImportToken,
  ImportTokenSummary,
} from '@/shared/types/importToken';

// The prefix tells an import token from a session JWT before any lookup, and
// makes a leaked one recognisable to secret scanners.
export const IMPORT_TOKEN_PREFIX = 'mxi_';
export const IMPORT_TOKEN_TTL_DAYS = 365;
const DAY_MS = 24 * 60 * 60 * 1000;

export class ImportTokenService {
  public async create(
    userId: string,
    name: string,
  ): Promise<CreatedImportToken> {
    const token = `${IMPORT_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    const summary = await importTokenRepository.create({
      userId,
      name,
      tokenHash: this.hash(token),
      expiresAt: new Date(Date.now() + IMPORT_TOKEN_TTL_DAYS * DAY_MS),
    });
    return { ...summary, token };
  }

  public async list(userId: string): Promise<ImportTokenSummary[]> {
    return importTokenRepository.findByUserId(userId);
  }

  public async revoke(id: string, userId: string): Promise<void> {
    await importTokenRepository.delete(id, userId);
  }

  public async authenticate(token: string): Promise<string> {
    const record = await importTokenRepository.findByHash(this.hash(token));
    if (!record) {
      throw new AuthError('INVALID_IMPORT_TOKEN', 'Invalid import token');
    }
    const now = new Date();
    if (record.expiresAt <= now) {
      throw new AuthError('IMPORT_TOKEN_EXPIRED', 'Import token expired');
    }
    await this.recordUse(record.id, now);
    return record.userId;
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async recordUse(id: string, usedAt: Date): Promise<void> {
    try {
      await importTokenRepository.markUsed(id, usedAt);
    } catch (err) {
      logger.warn(
        { err, importTokenId: id },
        'Failed to record import token use',
      );
    }
  }
}

export const importTokenService = new ImportTokenService();

export function bearerImportToken(req: NextRequest): string | null {
  const bearer = req.headers.get('authorization')?.split(' ')[1];
  return bearer?.startsWith(IMPORT_TOKEN_PREFIX) ? bearer : null;
}
