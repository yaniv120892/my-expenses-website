import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  importRepo,
  importedTxRepo,
  prismaMock,
  agentClient,
  findPotentialMatches,
  findMatchingTransaction,
} = vi.hoisted(() => ({
  importRepo: {
    findById: vi.fn(),
    updateStatus: vi.fn(),
    create: vi.fn(),
  },
  importedTxRepo: {
    findByUserIdAndImportId: vi.fn(),
    findByImportId: vi.fn(),
    findClaimedMatchingTransactionIds: vi.fn(),
  },
  prismaMock: {
    importedTransaction: { updateMany: vi.fn(), update: vi.fn() },
    import: { updateMany: vi.fn() },
  },
  agentClient: { submitExtractionRequest: vi.fn() },
  findPotentialMatches: vi.fn(),
  findMatchingTransaction: vi.fn(),
}));

vi.mock('@/server/repositories/importRepository', () => ({
  importRepository: importRepo,
}));
vi.mock('@/server/repositories/importedTransactionRepository', () => ({
  importedTransactionRepository: importedTxRepo,
}));
vi.mock('@/server/db/client', () => ({ default: prismaMock }));
vi.mock('@/server/repositories/transactionRepository', () => ({
  default: { findPotentialMatches },
}));
vi.mock('@/server/services/ai/aiServiceFactory', () => ({
  default: { getAIService: () => ({ findMatchingTransaction }) },
}));
vi.mock('@/server/clients/excelExtractionAgentClient', () => ({
  excelExtractionAgentClient: agentClient,
}));

import { importService } from '@/server/services/importService';

// Matching and the extraction-id write are private and covered elsewhere;
// stubbing them keeps these cases on the orchestration — which rows are
// re-matched, in what order, and how the import's status moves.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = importService as any;

const matchSingleTransaction = vi.fn();

const row = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  status: 'PENDING',
  matchingTransactionId: null,
  description: 'Coffee',
  date: new Date(2026, 2, 7),
  value: 10,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.IMPORTS_S3_BUCKET = 'bucket';
  process.env.IMPORTS_S3_REGION = 'us-east-1';
  importRepo.findById.mockResolvedValue({
    id: 'imp-1',
    userId: 'user-1',
    deleted: false,
    status: 'COMPLETED',
  });
  importedTxRepo.findByUserIdAndImportId.mockResolvedValue([row()]);
  importedTxRepo.findByImportId.mockResolvedValue([row()]);
  importedTxRepo.findClaimedMatchingTransactionIds.mockResolvedValue([]);
  matchSingleTransaction.mockResolvedValue(null);
  service.matchSingleTransaction = matchSingleTransaction;
});

describe('rematchImport', () => {
  const run = () => importService.rematchImport('imp-1', 'user-1');

  it('404s for a missing, foreign, or deleted import', async () => {
    importRepo.findById.mockResolvedValue(null);
    await expect(run()).rejects.toMatchObject({ status: 404 });

    importRepo.findById.mockResolvedValue({ id: 'imp-1', userId: 'other' });
    await expect(run()).rejects.toMatchObject({ status: 404 });

    importRepo.findById.mockResolvedValue({
      id: 'imp-1',
      userId: 'user-1',
      deleted: true,
    });
    await expect(run()).rejects.toMatchObject({ status: 404 });
  });

  it('409s unless the import is COMPLETED', async () => {
    importRepo.findById.mockResolvedValue({
      id: 'imp-1',
      userId: 'user-1',
      deleted: false,
      status: 'PROCESSING',
    });
    await expect(run()).rejects.toMatchObject({ status: 409 });
    expect(importRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('409s when nothing is pending', async () => {
    importedTxRepo.findByUserIdAndImportId.mockResolvedValue([
      row({ status: 'APPROVED' }),
    ]);
    await expect(run()).rejects.toMatchObject({ status: 409 });
    expect(importRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('clears pending matches, re-matches, and returns to COMPLETED', async () => {
    await run();

    expect(importRepo.updateStatus.mock.calls[0]).toEqual([
      'imp-1',
      'REMATCHING',
    ]);
    expect(prismaMock.importedTransaction.updateMany).toHaveBeenCalledWith({
      where: { importId: 'imp-1', userId: 'user-1', status: 'PENDING' },
      data: { matchingTransactionId: null },
    });
    expect(importRepo.updateStatus.mock.calls[1]).toEqual([
      'imp-1',
      'COMPLETED',
    ]);
  });

  it('excludes transactions already claimed by non-pending rows', async () => {
    importedTxRepo.findByUserIdAndImportId.mockResolvedValue([
      row(),
      row({ id: 'r2', status: 'APPROVED', matchingTransactionId: 'tx-taken' }),
      row({ id: 'r3', status: 'IGNORED', matchingTransactionId: null }),
    ]);

    await run();

    expect(matchSingleTransaction).toHaveBeenCalledTimes(1);
    const excluded = matchSingleTransaction.mock.calls[0][2] as Set<string>;
    expect([...excluded]).toEqual(['tx-taken']);
  });

  it('a match found mid-run is excluded from later rows', async () => {
    importedTxRepo.findByUserIdAndImportId.mockResolvedValue([
      row(),
      row({ id: 'r2' }),
    ]);
    matchSingleTransaction.mockResolvedValueOnce('tx-a');

    await run();

    const secondExcluded = matchSingleTransaction.mock
      .calls[1][2] as Set<string>;
    expect([...secondExcluded]).toEqual(['tx-a']);
  });

  it('one failing row does not abort the rest, and the import completes', async () => {
    importedTxRepo.findByUserIdAndImportId.mockResolvedValue([
      row(),
      row({ id: 'r2' }),
    ]);
    matchSingleTransaction.mockRejectedValueOnce(new Error('boom'));

    await run();

    expect(matchSingleTransaction).toHaveBeenCalledTimes(2);
    expect(importRepo.updateStatus.mock.calls[1]).toEqual([
      'imp-1',
      'COMPLETED',
    ]);
  });

  it('a failure outside the per-row guard marks the import FAILED', async () => {
    prismaMock.importedTransaction.updateMany.mockRejectedValue(
      new Error('db down'),
    );
    await expect(run()).rejects.toThrow('db down');
    expect(importRepo.updateStatus.mock.calls[1]).toEqual([
      'imp-1',
      'FAILED',
      'db down',
    ]);
  });
});

describe('processImport', () => {
  const url = 'https://bucket.s3.us-east-1.amazonaws.com/imports/f.xlsx';
  const run = (fileUrl = url) =>
    importService.processImport(fileUrl, 'user-1', 'f.xlsx', '03/2026');

  beforeEach(() => {
    importRepo.create.mockResolvedValue({ id: 'imp-1' });
    agentClient.submitExtractionRequest.mockResolvedValue({
      requestId: 'req-9',
    });
  });

  it('rejects a fileUrl outside the imports bucket', async () => {
    await expect(run('https://evil.example.com/x.xlsx')).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      run('https://bucket.s3.us-east-1.amazonaws.com/other/f.xlsx'),
    ).rejects.toMatchObject({ status: 400 });
    expect(importRepo.create).not.toHaveBeenCalled();
  });

  it('submits the extraction and records the request id', async () => {
    const result = await run();
    expect(result).toEqual({ id: 'imp-1' });
    expect(agentClient.submitExtractionRequest).toHaveBeenCalledWith({
      fileUrl: url,
      filename: 'f.xlsx',
      userId: 'user-1',
      importId: 'imp-1',
      options: {
        confidenceThreshold: 0.7,
        maxRetries: 3,
        includeRawData: false,
      },
    });
    // The import is created PROCESSING, so nothing re-states it here — the
    // callback carries the importId and may already have completed the import.
    expect(importRepo.updateStatus).not.toHaveBeenCalled();
    expect(prismaMock.import.updateMany).toHaveBeenCalledWith({
      where: { id: 'imp-1', extractionCompletedAt: null },
      data: { excelExtractionRequestId: 'req-9' },
    });
  });

  it('a rejected submit marks the import FAILED and rethrows', async () => {
    agentClient.submitExtractionRequest.mockRejectedValue(
      new Error('agent down'),
    );
    await expect(run()).rejects.toThrow('agent down');
    // Scoped to an unclaimed import: a callback that already completed (or
    // merged away) this import must not be overwritten with FAILED.
    expect(prismaMock.import.updateMany).toHaveBeenCalledWith({
      where: { id: 'imp-1', extractionCompletedAt: null },
      data: { status: 'FAILED', error: 'agent down' },
    });
  });

  it('a failed create never reaches the agent', async () => {
    importRepo.create.mockRejectedValue(new Error('insert failed'));
    await expect(run()).rejects.toThrow('insert failed');
    expect(agentClient.submitExtractionRequest).not.toHaveBeenCalled();
  });
});

describe('findPotentialMatchesForImport', () => {
  const run = () =>
    importService.findPotentialMatchesForImport('imp-1', 'user-1');

  /**
   * The exclusion set is one mutable Set shared across calls, so it has to be
   * snapshotted as each call happens rather than read back afterwards.
   */
  const recordExclusions = (matchIds: (string | null)[]) => {
    const seen: string[][] = [];
    let call = 0;
    matchSingleTransaction.mockImplementation(
      async (_tx: unknown, _userId: string, excluded: Set<string>) => {
        seen.push([...excluded]);
        return matchIds[call++] ?? null;
      },
    );
    return seen;
  };

  it('excludes transactions already claimed by another import', async () => {
    importedTxRepo.findClaimedMatchingTransactionIds.mockResolvedValue([
      'tx-taken',
    ]);
    const seen = recordExclusions([]);

    await run();

    expect(
      importedTxRepo.findClaimedMatchingTransactionIds,
    ).toHaveBeenCalledWith('user-1');
    expect(seen[0]).toEqual(['tx-taken']);
  });

  it('never offers one transaction to two rows of the same import', async () => {
    importedTxRepo.findByImportId.mockResolvedValue([
      row({ id: 'r1' }),
      row({ id: 'r2' }),
    ]);
    const seen = recordExclusions(['tx-1']);

    await run();

    expect(seen[0]).toEqual([]);
    expect(seen[1]).toEqual(['tx-1']);
  });

  it('leaves an already-matched row alone', async () => {
    importedTxRepo.findByImportId.mockResolvedValue([
      row({ id: 'r1', matchingTransactionId: 'tx-kept' }),
      row({ id: 'r2' }),
    ]);

    await run();

    expect(matchSingleTransaction).toHaveBeenCalledTimes(1);
    expect(matchSingleTransaction.mock.calls[0][0]).toMatchObject({ id: 'r2' });
  });

  it('keeps matching the remaining rows when one row throws', async () => {
    importedTxRepo.findByImportId.mockResolvedValue([
      row({ id: 'r1' }),
      row({ id: 'r2' }),
    ]);
    matchSingleTransaction.mockRejectedValueOnce(new Error('ai down'));

    await expect(run()).resolves.toBeUndefined();

    expect(matchSingleTransaction).toHaveBeenCalledTimes(2);
  });
});

describe('matchSingleTransaction', () => {
  // The instance property set in beforeEach shadows the real method; the
  // prototype still holds it.
  const realMatchSingleTransaction = Object.getPrototypeOf(
    service,
  ).matchSingleTransaction.bind(service) as (
    transaction: { id: string; description: string; date: Date; value: number },
    userId: string,
    excludedIds?: Set<string>,
  ) => Promise<string | null>;

  const candidates = [
    {
      id: 'tx-a',
      description: 'Coffee',
      date: new Date(2026, 2, 7),
      value: 10,
    },
    {
      id: 'tx-b',
      description: 'Bakery',
      date: new Date(2026, 2, 7),
      value: 10,
    },
  ];

  beforeEach(() => {
    findPotentialMatches.mockResolvedValue(candidates);
    prismaMock.importedTransaction.update.mockResolvedValue({});
  });

  it('stores the model answer only when it names a real candidate', async () => {
    findMatchingTransaction.mockResolvedValue('tx-b');

    const matched = await realMatchSingleTransaction(row(), 'user-1');

    expect(matched).toBe('tx-b');
    expect(prismaMock.importedTransaction.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { matchingTransactionId: 'tx-b' },
    });
  });

  it('discards an id the model invented instead of writing it', async () => {
    findMatchingTransaction.mockResolvedValue(
      '99999999-9999-4999-8999-999999999999',
    );

    const matched = await realMatchSingleTransaction(row(), 'user-1');

    expect(matched).toBeNull();
    expect(prismaMock.importedTransaction.update).not.toHaveBeenCalled();
  });

  it('leaves the row unmatched when the model finds no match', async () => {
    findMatchingTransaction.mockResolvedValue(null);

    const matched = await realMatchSingleTransaction(row(), 'user-1');

    expect(matched).toBeNull();
    expect(prismaMock.importedTransaction.update).not.toHaveBeenCalled();
  });
});
