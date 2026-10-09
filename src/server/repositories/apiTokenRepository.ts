import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/server/db/client';
import type { ApiTokenScope, ApiTokenSummary } from '@/shared/types/apiToken';

const CREDENTIAL_SELECT = {
  id: true,
  userId: true,
  scopes: true,
  expiresAt: true,
  lastUsedAt: true,
} as const;

type ApiTokenCredential = Prisma.ApiTokenGetPayload<{
  select: typeof CREDENTIAL_SELECT;
}>;

const SUMMARY_SELECT = {
  id: true,
  name: true,
  scopes: true,
  createdAt: true,
  expiresAt: true,
  lastUsedAt: true,
} as const;

export class ApiTokenRepository {
  public async create(data: {
    userId: string;
    name: string;
    tokenHash: string;
    scopes: ApiTokenScope[];
    expiresAt: Date;
  }): Promise<ApiTokenSummary> {
    return prisma.apiToken.create({ data, select: SUMMARY_SELECT });
  }

  public async findByUserId(userId: string): Promise<ApiTokenSummary[]> {
    return prisma.apiToken.findMany({
      where: { userId },
      select: SUMMARY_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  public async findByHash(
    tokenHash: string,
  ): Promise<ApiTokenCredential | null> {
    return prisma.apiToken.findUnique({
      where: { tokenHash },
      select: CREDENTIAL_SELECT,
    });
  }

  public async markUsed(id: string, usedAt: Date): Promise<void> {
    await prisma.apiToken.update({
      where: { id },
      data: { lastUsedAt: usedAt },
    });
  }

  public async delete(id: string, userId: string): Promise<void> {
    await prisma.apiToken.delete({ where: { id, userId } });
  }
}

export const apiTokenRepository = new ApiTokenRepository();
