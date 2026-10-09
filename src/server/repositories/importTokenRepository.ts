import prisma from '@/server/db/client';
import type { ImportTokenSummary } from '@/shared/types/importToken';

type ImportTokenCredential = {
  id: string;
  userId: string;
  expiresAt: Date;
  lastUsedAt: Date | null;
};

const SUMMARY_SELECT = {
  id: true,
  name: true,
  createdAt: true,
  expiresAt: true,
  lastUsedAt: true,
} as const;

export class ImportTokenRepository {
  public async create(data: {
    userId: string;
    name: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<ImportTokenSummary> {
    return prisma.importToken.create({ data, select: SUMMARY_SELECT });
  }

  public async findByUserId(userId: string): Promise<ImportTokenSummary[]> {
    return prisma.importToken.findMany({
      where: { userId },
      select: SUMMARY_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  public async findByHash(
    tokenHash: string,
  ): Promise<ImportTokenCredential | null> {
    return prisma.importToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, lastUsedAt: true },
    });
  }

  public async markUsed(id: string, usedAt: Date): Promise<void> {
    await prisma.importToken.update({
      where: { id },
      data: { lastUsedAt: usedAt },
    });
  }

  public async delete(id: string, userId: string): Promise<void> {
    await prisma.importToken.delete({ where: { id, userId } });
  }
}

export const importTokenRepository = new ImportTokenRepository();
