import { addYears } from 'date-fns';
import { hashApiToken, mintApiToken } from '@/server/auth/apiTokenFormat';
import { apiTokenRepository } from '@/server/repositories/apiTokenRepository';
import type {
  ApiTokenScope,
  ApiTokenSummary,
  CreatedApiToken,
} from '@/shared/types/apiToken';

export class ApiTokenService {
  public async create(
    userId: string,
    name: string,
    scopes: ApiTokenScope[],
  ): Promise<CreatedApiToken> {
    const token = mintApiToken();
    const summary = await apiTokenRepository.create({
      userId,
      name,
      tokenHash: hashApiToken(token),
      scopes: [...new Set(scopes)],
      expiresAt: addYears(new Date(), 1),
    });
    return { ...summary, token };
  }

  public async list(userId: string): Promise<ApiTokenSummary[]> {
    return apiTokenRepository.findByUserId(userId);
  }

  public async revoke(id: string, userId: string): Promise<void> {
    await apiTokenRepository.delete(id, userId);
  }
}

export const apiTokenService = new ApiTokenService();
