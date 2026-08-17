import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  importRepo,
  importedTxRepo,
  prismaMock,
  findPotentialMatchesForImport,
} = vi.hoisted(() => ({
  importRepo: {
    findByExtractionRequestId: vi.fn(),
    findById: vi.fn(),
    findExisting: vi.fn(),
    updateStatus: vi.fn(),
  },
  importedTxRepo: {
    filterDuplicates: vi.fn(),
    createMany: vi.fn(),
  },
  prismaMock: {
    import: { update: vi.fn(), delete: vi.fn() },
  },
  findPotentialMatchesForImport: vi.fn(),
}));

vi.mock('@/server/utils/webhookAuth', () => ({
  extractWebhookParams: () => ({
    token: 't',
    userId: 'user-1',
    timestamp: 123,
  }),
  verifyWebhookToken: () => true,
}));
vi.mock('@/server/repositories/importRepository', () => ({
  importRepository: importRepo,
}));
vi.mock('@/server/repositories/importedTransactionRepository', () => ({
  importedTransactionRepository: importedTxRepo,
}));
vi.mock('@/server/db/client', () => ({ default: prismaMock }));
vi.mock('@/server/services/importService', () => ({
  importService: {
    findPotentialMatchesForImport: (...a: unknown[]) =>
      findPotentialMatchesForImport(...a),
  },
}));

import { processExcelExtractionWebhook } from '@/server/webhooks/excelExtractionWebhook';

const payload = (transactions: unknown[]) => ({
  requestId: 'req-1',
  status: 'COMPLETED',
  result: {
    transactions,
    metadata: {
      creditCardLastFour: '4242',
      paymentMonth: '03/2026',
      bankSourceType: 'BANK_CREDIT',
    },
  },
});

const tx = (description = 'Coffee') => ({
  date: '07/03/2026',
  description,
  value: 12.5,
  type: 'EXPENSE',
});

const run = (body: unknown) => processExcelExtractionWebhook(body, {});

beforeEach(() => {
  vi.clearAllMocks();
  importRepo.findByExtractionRequestId.mockResolvedValue({
    id: 'imp-1',
    userId: 'user-1',
  });
  importRepo.findById.mockResolvedValue({ id: 'imp-1', userId: 'user-1' });
  importRepo.findExisting.mockResolvedValue(null);
  importedTxRepo.filterDuplicates.mockResolvedValue([]);
  findPotentialMatchesForImport.mockResolvedValue(undefined);
});

describe('completed extraction', () => {
  it('no duplicate: inserts rows, matches, marks COMPLETED', async () => {
    const res = await run(payload([tx()]));
    expect(res.status).toBe(200);

    const rows = importedTxRepo.createMany.mock.calls[0][0];
    expect(rows).toEqual([
      {
        description: 'Coffee',
        value: 12.5,
        date: new Date(2026, 2, 7),
        type: 'EXPENSE',
        rawData: {},
        matchingTransactionId: null,
        importId: 'imp-1',
        userId: 'user-1',
      },
    ]);
    expect(findPotentialMatchesForImport).toHaveBeenCalledWith(
      'imp-1',
      'user-1',
    );
    expect(importRepo.updateStatus).toHaveBeenCalledWith('imp-1', 'COMPLETED');
    expect(prismaMock.import.delete).not.toHaveBeenCalled();
  });

  it('writes metadata before looking for a duplicate', async () => {
    await run(payload([tx()]));
    expect(prismaMock.import.update).toHaveBeenCalledWith({
      where: { id: 'imp-1' },
      data: {
        creditCardLastFourDigits: '4242',
        paymentMonth: '03/2026',
        bankSourceType: 'BANK_CREDIT',
      },
    });
    const updateOrder =
      prismaMock.import.update.mock.invocationCallOrder[0] ?? 0;
    const findOrder = importRepo.findExisting.mock.invocationCallOrder[0] ?? 0;
    expect(updateOrder).toBeLessThan(findOrder);
  });

  it('no duplicate and zero transactions: skips insert, still finalizes', async () => {
    await run(payload([]));
    expect(importedTxRepo.createMany).not.toHaveBeenCalled();
    expect(importRepo.updateStatus).toHaveBeenCalledWith('imp-1', 'COMPLETED');
  });

  it('duplicate: merges non-duplicates into it and drops this import', async () => {
    importRepo.findExisting.mockResolvedValue({ id: 'imp-old' });
    importedTxRepo.filterDuplicates.mockImplementation(
      async (_id, rows) => rows,
    );

    await run(payload([tx()]));

    // filterDuplicates receives rows still carrying the CURRENT import id
    const [scopeId, offered] = importedTxRepo.filterDuplicates.mock.calls[0];
    expect(scopeId).toBe('imp-old');
    expect(offered[0]).toMatchObject({ importId: 'imp-1', userId: 'user-1' });

    // ...and they are re-pointed at the surviving import on insert
    expect(importedTxRepo.createMany).toHaveBeenCalledTimes(1);
    expect(importedTxRepo.createMany.mock.calls[0][0][0]).toMatchObject({
      importId: 'imp-old',
      userId: 'user-1',
    });

    expect(findPotentialMatchesForImport).toHaveBeenCalledWith(
      'imp-old',
      'user-1',
    );
    expect(prismaMock.import.delete).toHaveBeenCalledWith({
      where: { id: 'imp-1' },
    });
    expect(importRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('duplicate with nothing new: still drops this import, inserts nothing', async () => {
    importRepo.findExisting.mockResolvedValue({ id: 'imp-old' });
    importedTxRepo.filterDuplicates.mockResolvedValue([]);

    await run(payload([tx()]));

    expect(importedTxRepo.createMany).not.toHaveBeenCalled();
    expect(prismaMock.import.delete).toHaveBeenCalledWith({
      where: { id: 'imp-1' },
    });
    expect(findPotentialMatchesForImport).toHaveBeenCalledWith(
      'imp-old',
      'user-1',
    );
    expect(importRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('findExisting returning this same import is not a duplicate', async () => {
    importRepo.findExisting.mockResolvedValue({ id: 'imp-1' });

    await run(payload([tx()]));

    expect(importedTxRepo.filterDuplicates).not.toHaveBeenCalled();
    expect(prismaMock.import.delete).not.toHaveBeenCalled();
    expect(importRepo.updateStatus).toHaveBeenCalledWith('imp-1', 'COMPLETED');
  });

  it('a failing match is swallowed and the import still finalizes', async () => {
    findPotentialMatchesForImport.mockRejectedValue(new Error('boom'));
    const res = await run(payload([tx()]));
    expect(res.status).toBe(200);
    expect(importRepo.updateStatus).toHaveBeenCalledWith('imp-1', 'COMPLETED');
  });

  it('a missing import record fails the webhook', async () => {
    importRepo.findById.mockResolvedValue(null);
    const res = await run(payload([tx()]));
    expect(res.status).toBe(500);
  });

  it('rawData defaults to an empty object', async () => {
    await run(payload([{ ...tx(), rawData: { a: 1 } }, tx('Tea')]));
    const rows = importedTxRepo.createMany.mock.calls[0][0];
    expect(rows[0].rawData).toEqual({ a: 1 });
    expect(rows[1].rawData).toEqual({});
  });

  // An import only ever leaves PROCESSING through this callback, and the
  // sibling service does not retry, so an unusable result has to land as
  // FAILED rather than as a 400 with the import still pending.
  it('a COMPLETED payload with no result fails the import', async () => {
    const res = await run({ requestId: 'req-1', status: 'COMPLETED' });

    expect(res.status).toBe(400);
    expect(importRepo.updateStatus).toHaveBeenCalledWith(
      'imp-1',
      'FAILED',
      expect.any(String),
    );
  });

  it('one unreadable row fails the import rather than the request only', async () => {
    const res = await run(
      payload([{ ...tx(), date: 'the fifth of August' } as never]),
    );

    expect(res.status).toBe(400);
    expect(importRepo.updateStatus).toHaveBeenCalledWith(
      'imp-1',
      'FAILED',
      expect.any(String),
    );
  });

  // The sibling service is not ours to constrain: a day written without a
  // leading zero, or a statement with no card digits, is still importable.
  it('accepts a non-padded date and absent card metadata', async () => {
    const res = await run({
      requestId: 'req-1',
      status: 'COMPLETED',
      result: {
        transactions: [{ ...tx(), date: '5/8/2026' }],
        metadata: { paymentMonth: null, creditCardLastFour: null },
      },
    });

    expect(res.status).toBe(200);
    const rows = importedTxRepo.createMany.mock.calls[0][0];
    expect(rows[0].date).toEqual(new Date(2026, 7, 5));
    // Nothing identifies a duplicate without a card and month.
    expect(importRepo.findExisting).not.toHaveBeenCalled();
  });

  it('marks the import failed when processing throws', async () => {
    importedTxRepo.createMany.mockRejectedValue(new Error('insert failed'));

    const res = await run(payload([tx()]));

    expect(res.status).toBe(500);
    expect(importRepo.updateStatus).toHaveBeenCalledWith(
      'imp-1',
      'FAILED',
      expect.any(String),
    );
  });
});
