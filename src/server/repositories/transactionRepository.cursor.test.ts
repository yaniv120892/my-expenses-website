import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/server/db/client', () => ({
  default: { transaction: { findMany } },
}));

import transactionRepository from '@/server/repositories/transactionRepository';

const DATE = '2026-01-15T00:00:00.000Z';
const ID = '3f2f1a10-6a37-4dc5-9c5e-1f8a5f4d2b6a';

function amountCursor(amount: string): string {
  return Buffer.from(JSON.stringify([amount, DATE, ID])).toString('base64url');
}

function listByAmount(cursor: string) {
  return transactionRepository.getTransactionsList({
    userId: 'user-1',
    sortBy: 'amount',
    sortOrder: 'desc',
    limit: 10,
    cursor,
  });
}

describe('transactionRepository.getTransactionsList amount cursor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([]);
  });

  it('pages past a finite amount', async () => {
    await listByAmount(amountCursor('12.5'));

    const cursorWhere = findMany.mock.calls[0]?.[0].where.OR;
    expect(cursorWhere[0]).toEqual({ AND: [{ value: { lt: 12.5 } }] });
  });

  it.each(['1e400', 'abc', ' '])('refuses %j with a 400 before querying', async (amount) => {
    await expect(listByAmount(amountCursor(amount))).rejects.toMatchObject({
      status: 400,
      message: 'Invalid cursor',
    });
    expect(findMany).not.toHaveBeenCalled();
  });
});
