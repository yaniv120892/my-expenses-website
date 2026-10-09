import { randomBytes } from 'node:crypto';
import { addYears } from 'date-fns';
import {
  IMPORT_TOKEN_PREFIX,
  hashImportToken,
} from '@/server/auth/importTokens';
import { importTokenRepository } from '@/server/repositories/importTokenRepository';
import type {
  CreatedImportToken,
  ImportTokenSummary,
} from '@/shared/types/importToken';

export class ImportTokenService {
  public async create(
    userId: string,
    name: string,
  ): Promise<CreatedImportToken> {
    const token = `${IMPORT_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
    const summary = await importTokenRepository.create({
      userId,
      name,
      tokenHash: hashImportToken(token),
      expiresAt: addYears(new Date(), 1),
    });
    return { ...summary, token };
  }

  public async list(userId: string): Promise<ImportTokenSummary[]> {
    return importTokenRepository.findByUserId(userId);
  }

  public async revoke(id: string, userId: string): Promise<void> {
    await importTokenRepository.delete(id, userId);
  }
}

export const importTokenService = new ImportTokenService();
