import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  importRepo,
  importedTxRepo,
  prismaMock,
  findPotentialMatchesForImport,
  extractWebhookParams,
} = vi.hoisted(() => ({
  importRepo: {
    findByExtractionRequestId: vi.fn(),
    findById: vi.fn(),
    findExisting: vi.fn(),
    updateStatus: vi.fn(),
    claimExtraction: vi.fn(),
  },
  importedTxRepo: {
    filterDuplicates: vi.fn(),
    createMany: vi.fn(),
    findByImportId: vi.fn(),
    moveToImportOps: vi.fn(),
    deleteByImportIdOp: vi.fn(),
  },
  prismaMock: {
    import: { update: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  },
  findPotentialMatchesForImport: vi.fn(),
  extractWebhookParams: vi.fn(),
}));

vi.mock('@/server/utils/webhookAuth', () => ({
  extractWebhookParams: (...a: unknown[]) => extractWebhookParams(...a),
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

const CREATED_AT = new Date('2026-03-10T10:00:00.000Z');
const OLDER = new Date('2026-03-10T09:00:00.000Z');
const NEWER = new Date('2026-03-10T11:00:00.000Z');

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

const storedRow = (id: string, description = 'Coffee') => ({
  id,
  description,
  value: 12.5,
  date: new Date(2026, 2, 7),
  type: 'EXPENSE',
  importId: 'imp-1',
  userId: 'user-1',
});

const run = (body: unknown) => processExcelExtractionWebhook(body, {});

beforeEach(() => {
  // reset, not clear: a mockRejectedValue set by one case would otherwise
  // stay in force for every case after it.
  vi.resetAllMocks();
  importedTxRepo.createMany.mockResolvedValue(1);
  extractWebhookParams.mockReturnValue({
    token: 't',
    userId: 'user-1',
    timestamp: 123,
  });
  importRepo.findByExtractionRequestId.mockResolvedValue({
    id: 'imp-1',
    userId: 'user-1',
    createdAt: CREATED_AT,
  });
  importRepo.findById.mockResolvedValue({
    id: 'imp-1',
    userId: 'user-1',
    createdAt: CREATED_AT,
  });
  importRepo.findExisting.mockResolvedValue(null);
  importRepo.claimExtraction.mockResolvedValue(true);
  importedTxRepo.filterDuplicates.mockResolvedValue([]);
  importedTxRepo.findByImportId.mockResolvedValue([]);
  // The repository hands back unawaited Prisma ops; the tests only care that
  // they were built for the right rows and batched together.
  importedTxRepo.moveToImportOps.mockImplementation(
    (ids: string[], to: string) =>
      ids.length ? [{ op: 'move', ids, to }] : [],
  );
  importedTxRepo.deleteByImportIdOp.mockImplementation((id: string) => ({
    op: 'deleteRows',
    id,
  }));
  prismaMock.import.delete.mockImplementation((args: unknown) => ({
    op: 'deleteImport',
    args,
  }));
  prismaMock.$transaction.mockResolvedValue([]);
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

  it('inserts its own rows before looking for a duplicate', async () => {
    await run(payload([tx()]));

    const insertOrder = importedTxRepo.createMany.mock.invocationCallOrder[0];
    const findOrder = importRepo.findExisting.mock.invocationCallOrder[0];
    expect(insertOrder).toBeLessThan(findOrder);
  });

  it('no duplicate and zero transactions: skips insert, still finalizes', async () => {
    await run(payload([]));
    expect(importedTxRepo.createMany).not.toHaveBeenCalled();
    expect(importRepo.updateStatus).toHaveBeenCalledWith('imp-1', 'COMPLETED');
  });

  it('older duplicate: moves non-duplicate rows into it and drops this import', async () => {
    importRepo.findExisting.mockResolvedValue({
      id: 'imp-old',
      createdAt: OLDER,
    });
    importedTxRepo.findByImportId.mockResolvedValue([
      storedRow('row-1'),
      storedRow('row-2', 'Tea'),
    ]);
    importedTxRepo.filterDuplicates.mockImplementation(async (_id, rows) =>
      rows.slice(0, 1),
    );

    await run(payload([tx(), tx('Tea')]));

    const [scopeId] = importedTxRepo.filterDuplicates.mock.calls[0];
    expect(scopeId).toBe('imp-old');

    expect(importedTxRepo.moveToImportOps).toHaveBeenCalledWith(
      ['row-1'],
      'imp-old',
    );
    // Move, remove-the-leftovers and drop-the-import go as one batch: the
    // duplicate row left behind would block the delete, and a partial apply
    // would strand rows under an import that still exists.
    expect(prismaMock.$transaction).toHaveBeenCalledWith([
      { op: 'move', ids: ['row-1'], to: 'imp-old' },
      { op: 'deleteRows', id: 'imp-1' },
      { op: 'deleteImport', args: { where: { id: 'imp-1' } } },
    ]);
    expect(findPotentialMatchesForImport).toHaveBeenCalledWith(
      'imp-old',
      'user-1',
    );
    expect(importRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('a newer import is not a merge target, so neither side deletes the other', async () => {
    importRepo.findExisting.mockResolvedValue({
      id: 'imp-new',
      createdAt: NEWER,
    });

    await run(payload([tx()]));

    expect(importedTxRepo.moveToImportOps).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(importRepo.updateStatus).toHaveBeenCalledWith('imp-1', 'COMPLETED');
  });

  it('breaks a createdAt tie on id so only one side merges', async () => {
    importRepo.findExisting.mockResolvedValue({
      id: 'imp-0',
      createdAt: CREATED_AT,
    });
    importedTxRepo.findByImportId.mockResolvedValue([storedRow('row-1')]);
    importedTxRepo.filterDuplicates.mockImplementation(
      async (_id, rows) => rows,
    );

    await run(payload([tx()]));

    expect(prismaMock.import.delete).toHaveBeenCalledWith({
      where: { id: 'imp-1' },
    });
  });

  it('findExisting returning this same import is not a duplicate', async () => {
    importRepo.findExisting.mockResolvedValue({
      id: 'imp-1',
      createdAt: CREATED_AT,
    });

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
    importRepo.findByExtractionRequestId.mockResolvedValue(null);
    const res = await run(payload([tx()]));
    expect(res.status).toBe(404);
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

describe('callback resolution', () => {
  it('resolves by the signed importId when present', async () => {
    extractWebhookParams.mockReturnValue({
      token: 't',
      userId: 'user-1',
      timestamp: 123,
      importId: 'imp-1',
    });

    const res = await run(payload([tx()]));

    expect(res.status).toBe(200);
    expect(importRepo.findByExtractionRequestId).not.toHaveBeenCalled();
    expect(importRepo.findById).toHaveBeenCalledWith('imp-1');
  });

  it('falls back to the requestId for callbacks issued without an importId', async () => {
    const res = await run(payload([tx()]));

    expect(res.status).toBe(200);
    expect(importRepo.findByExtractionRequestId).toHaveBeenCalledWith('req-1');
  });

  it('rejects a callback for another user', async () => {
    importRepo.findByExtractionRequestId.mockResolvedValue({
      id: 'imp-1',
      userId: 'someone-else',
      createdAt: CREATED_AT,
    });

    const res = await run(payload([tx()]));

    expect(res.status).toBe(403);
    expect(importRepo.claimExtraction).not.toHaveBeenCalled();
  });
});

describe('redelivered callbacks', () => {
  it('is a no-op when another callback already claimed the extraction', async () => {
    importRepo.claimExtraction.mockResolvedValue(false);

    const res = await run(payload([tx()]));

    expect(res.status).toBe(200);
    expect(importedTxRepo.createMany).not.toHaveBeenCalled();
    expect(importRepo.updateStatus).not.toHaveBeenCalled();
    expect(prismaMock.import.delete).not.toHaveBeenCalled();
  });

  it('marks FAILED but keeps the claim when processing throws', async () => {
    importedTxRepo.createMany.mockRejectedValue(new Error('insert exploded'));

    const res = await run(payload([tx()]));

    expect(res.status).toBe(500);
    expect(importRepo.updateStatus).toHaveBeenCalledWith(
      'imp-1',
      'FAILED',
      'Processing the extraction result failed',
    );

    // Handing the claim back would let a redelivery re-run createMany and
    // insert every row a second time.
    importedTxRepo.createMany.mockResolvedValue(1);
    importRepo.claimExtraction.mockResolvedValue(false);
    const redelivery = await run(payload([tx()]));

    expect(redelivery.status).toBe(200);
    expect(importedTxRepo.createMany).toHaveBeenCalledTimes(1);
  });

  it('claims before doing any work', async () => {
    await run(payload([tx()]));

    const claimOrder = importRepo.claimExtraction.mock.invocationCallOrder[0];
    const insertOrder = importedTxRepo.createMany.mock.invocationCallOrder[0];
    expect(claimOrder).toBeLessThan(insertOrder);
  });
});
