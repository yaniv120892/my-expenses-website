import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  importRepo,
  importedTxRepo,
  prismaMock,
  agentClient,
  findPotentialMatches,
  findPotentialMatchesForCharges,
  findMatchingTransaction,
  updateStatusOp,
  markApprovedOp,
  getTransactionItem,
  createTransactionOp,
  updateTransactionOp,
  txService,
  autoApproveRuleRepo,
} = vi.hoisted(() => ({
  importRepo: {
    findById: vi.fn(),
    updateStatus: vi.fn(),
    create: vi.fn(),
  },
  importedTxRepo: {
    findById: vi.fn(),
    findByUserIdAndImportId: vi.fn(),
    findByImportId: vi.fn(),
    findPendingByImportId: vi.fn(),
    findPendingByIds: vi.fn(),
    findClaimedMatchingTransactionIds: vi.fn(),
    updateStatusBatch: vi.fn(),
    updateStatus: vi.fn(),
  },
  prismaMock: {
    importedTransaction: { updateMany: vi.fn(), update: vi.fn() },
    import: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
  agentClient: { submitExtractionRequest: vi.fn() },
  findPotentialMatches: vi.fn(),
  findPotentialMatchesForCharges: vi.fn(),
  findMatchingTransaction: vi.fn(),
  getTransactionItem: vi.fn(),
  createTransactionOp: vi.fn(),
  updateTransactionOp: vi.fn(),
  txService: {
    prepareCreateTransaction: vi.fn(),
    notifyTransactionCreatedSafe: vi.fn(),
    notifyTransactionsCreatedSafe: vi.fn(),
    learnCategoryMappingSafe: vi.fn(),
  },
  updateStatusOp: vi.fn(),
  markApprovedOp: vi.fn(),
  autoApproveRuleRepo: { findActiveByUserId: vi.fn() },
}));

vi.mock('@/server/repositories/importRepository', () => ({
  importRepository: importRepo,
}));
vi.mock('@/server/repositories/importedTransactionRepository', () => ({
  importedTransactionRepository: {
    ...importedTxRepo,
    updateStatusOp,
    markApprovedOp,
  },
}));
vi.mock('@/server/repositories/autoApproveRuleRepository', () => ({
  autoApproveRuleRepository: autoApproveRuleRepo,
}));
vi.mock('@/server/db/client', () => ({ default: prismaMock }));
vi.mock('@/server/repositories/transactionRepository', () => ({
  default: {
    findPotentialMatches,
    findPotentialMatchesForCharges,
    getTransactionItem,
    createTransactionOp,
    updateTransactionOp,
  },
}));
vi.mock('@/server/services/transactionService', () => ({ default: txService }));
vi.mock('@/server/clients/excelExtractionAgentClient', () => ({
  excelExtractionAgentClient: agentClient,
}));

import { importService } from '@/server/services/importService';

// Matching is stubbed to keep these cases on orchestration; the real method has
// its own describe below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = importService as any;

const matchSingleTransaction = vi.fn();

const pendingRow = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  userId: 'user-1',
  status: 'PENDING',
  description: 'Coffee',
  value: 12.5,
  date: new Date(2026, 2, 7),
  type: 'EXPENSE',
  matchingTransaction: null,
  ...over,
});

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
  txService.prepareCreateTransaction.mockResolvedValue({ id: 'model' });
  prismaMock.$transaction.mockResolvedValue([{ id: 'created-1' }]);
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

  it("excludes transactions another import's pending rows claim", async () => {
    importedTxRepo.findClaimedMatchingTransactionIds.mockResolvedValue([
      'tx-other-import',
    ]);

    await run();

    const excluded = matchSingleTransaction.mock.calls[0][2] as Set<string>;
    expect([...excluded]).toEqual(['tx-other-import']);
    expect(
      prismaMock.importedTransaction.updateMany.mock.invocationCallOrder[0],
    ).toBeLessThan(
      importedTxRepo.findClaimedMatchingTransactionIds.mock
        .invocationCallOrder[0],
    );
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
    // The callback may already have completed the import, so the status is not re-stated.
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

  it('leaves an approved or ignored row alone even though it holds no match', async () => {
    importedTxRepo.findByImportId.mockResolvedValue([
      row({ id: 'r1', status: 'APPROVED' }),
      row({ id: 'r2', status: 'IGNORED' }),
      row({ id: 'r3' }),
    ]);

    await run();

    expect(matchSingleTransaction).toHaveBeenCalledTimes(1);
    expect(matchSingleTransaction.mock.calls[0][0]).toMatchObject({ id: 'r3' });
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

  // Spelled like neither candidate, so the model decides.
  const ambiguousRow = () => row({ description: 'Coffee Shop' });

  const originalGetAiProvider = service.getAiProvider;

  beforeEach(() => {
    // The file-level beforeEach stubs the method; this describe wants the
    // real one, with the provider stubbed at its instance getter instead.
    delete service.matchSingleTransaction;
    service.getAiProvider = () => ({ findMatchingTransaction });
    findPotentialMatches.mockResolvedValue(candidates);
    prismaMock.importedTransaction.update.mockResolvedValue({});
  });

  afterEach(() => {
    // Direct property assignment survives vi.clearAllMocks; restore so no
    // later describe inherits the override.
    service.getAiProvider = originalGetAiProvider;
  });

  it('stores the id the provider validated', async () => {
    findMatchingTransaction.mockResolvedValue('tx-b');

    const matched = await service.matchSingleTransaction(
      ambiguousRow(),
      'user-1',
    );

    expect(matched).toBe('tx-b');
    expect(prismaMock.importedTransaction.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { matchingTransactionId: 'tx-b' },
    });
  });

  it("gives the provider the row's amount, date and type, not just its description", async () => {
    findMatchingTransaction.mockResolvedValue(null);

    await service.matchSingleTransaction(
      row({ description: 'Coffee Shop', type: 'EXPENSE' }),
      'user-1',
    );

    expect(findMatchingTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Coffee Shop',
        value: 10,
        date: new Date(2026, 2, 7),
        type: 'EXPENSE',
      }),
      candidates,
    );
  });

  it('leaves the row unmatched when the provider reports none', async () => {
    findMatchingTransaction.mockResolvedValue(null);

    const matched = await service.matchSingleTransaction(
      ambiguousRow(),
      'user-1',
    );

    expect(matched).toBeNull();
    expect(prismaMock.importedTransaction.update).not.toHaveBeenCalled();
  });

  it('asks only for candidates of the same direction', async () => {
    await service.matchSingleTransaction(row({ type: 'EXPENSE' }), 'user-1');

    expect(findPotentialMatches).toHaveBeenCalledWith(
      'user-1',
      new Date(2026, 2, 7),
      10,
      'EXPENSE',
    );
  });

  it('claims an unambiguous spelling match without calling the provider', async () => {
    const matched = await service.matchSingleTransaction(row(), 'user-1');

    expect(matched).toBe('tx-a');
    expect(findMatchingTransaction).not.toHaveBeenCalled();
    expect(prismaMock.importedTransaction.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { matchingTransactionId: 'tx-a' },
    });
  });

  it('defers to the provider when two candidates share a spelling', async () => {
    findPotentialMatches.mockResolvedValue([
      candidates[0],
      { ...candidates[1], description: 'coffee!' },
    ]);
    findMatchingTransaction.mockResolvedValue('tx-b');

    const matched = await service.matchSingleTransaction(row(), 'user-1');

    expect(matched).toBe('tx-b');
    expect(findMatchingTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('buildReconciliationPlan', () => {
  const matchedTransaction = {
    id: 'tx-1',
    description: 'Coffee at the corner',
    value: 11,
    date: new Date(2026, 2, 5),
    status: 'PENDING_APPROVAL',
    categoryId: 'category-1',
  };

  const pendingRow = (over: Record<string, unknown> = {}) => ({
    id: 'r1',
    userId: 'user-1',
    status: 'PENDING',
    description: 'Coffee',
    value: 12.5,
    date: new Date(2026, 2, 7),
    type: 'EXPENSE',
    matchingTransaction: null,
    ...over,
  });

  const candidateTransaction = (over: Record<string, unknown> = {}) => ({
    id: 'tx-bruno',
    description: 'Food for Bruno',
    value: 470,
    date: new Date(2026, 5, 17),
    type: 'EXPENSE',
    status: 'APPROVED',
    ...over,
  });

  beforeEach(() => {
    findPotentialMatchesForCharges.mockResolvedValue([]);
    importedTxRepo.findClaimedMatchingTransactionIds.mockResolvedValue([]);
  });

  it('plans a CREATE for a row with no match', async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([pendingRow()]);

    const plan = await importService.buildReconciliationPlan('imp-1', 'user-1');

    expect(plan).toEqual([
      {
        importedTransactionId: 'r1',
        action: 'CREATE',
        description: 'Coffee',
        value: 12.5,
        date: new Date(2026, 2, 7),
        type: 'EXPENSE',
        categoryId: null,
        match: null,
        reviewHint: null,
      },
    ]);
  });

  it('flags a CREATE whose window holds an unclaimed transaction', async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([
      pendingRow({ value: 470, date: new Date(2026, 5, 16) }),
    ]);
    findPotentialMatchesForCharges.mockResolvedValue([
      candidateTransaction({ id: 'tx-bruno' }),
    ]);

    const [item] = await importService.buildReconciliationPlan(
      'imp-1',
      'user-1',
    );

    expect(item.action).toBe('CREATE');
    expect(item.reviewHint).toMatchObject({
      reason: 'unmatched-candidate',
      counterpart: { transactionId: 'tx-bruno' },
      candidateCount: 1,
    });
    expect(findPotentialMatchesForCharges).toHaveBeenCalledTimes(1);
  });

  it('does not flag a candidate another pending row already claims', async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([
      pendingRow({ value: 470, date: new Date(2026, 5, 16) }),
    ]);
    findPotentialMatchesForCharges.mockResolvedValue([
      candidateTransaction({ id: 'tx-claimed' }),
    ]);
    importedTxRepo.findClaimedMatchingTransactionIds.mockResolvedValue([
      'tx-claimed',
    ]);

    const [item] = await importService.buildReconciliationPlan(
      'imp-1',
      'user-1',
    );

    expect(item.reviewHint).toBeNull();
  });

  it('flags an unrelated MERGE without querying for candidates', async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([
      pendingRow({
        description: 'Pet shop',
        matchingTransaction: matchedTransaction,
      }),
    ]);

    const [item] = await importService.buildReconciliationPlan(
      'imp-1',
      'user-1',
    );

    expect(item.action).toBe('MERGE');
    expect(item.reviewHint).toEqual({ reason: 'unrelated-merge' });
    expect(findPotentialMatchesForCharges).not.toHaveBeenCalled();
  });

  it('plans a MERGE carrying the diff the commit would write', async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([
      pendingRow({ matchingTransaction: matchedTransaction }),
    ]);

    const [item] = await importService.buildReconciliationPlan(
      'imp-1',
      'user-1',
    );

    expect(item.action).toBe('MERGE');
    expect(item.categoryId).toBe('category-1');
    expect(item.match).toEqual({
      transactionId: 'tx-1',
      approvesPendingTransaction: true,
      before: {
        description: 'Coffee at the corner',
        value: 11,
        date: new Date(2026, 2, 5),
      },
    });
    expect(item.description).toBe('Coffee');
    expect(item.value).toBe(12.5);
    expect(item.date).toEqual(new Date(2026, 2, 7));
  });

  it('marks a merge onto an already approved transaction as no approval', async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([
      pendingRow({
        matchingTransaction: { ...matchedTransaction, status: 'APPROVED' },
      }),
    ]);

    const [item] = await importService.buildReconciliationPlan(
      'imp-1',
      'user-1',
    );

    expect(item.match).not.toBeNull();
    expect(item.match?.approvesPendingTransaction).toBe(false);
  });

  it("asks only for this user's pending rows in the import", async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([]);

    await importService.buildReconciliationPlan('imp-1', 'user-1');

    expect(importedTxRepo.findPendingByImportId).toHaveBeenCalledWith(
      'imp-1',
      'user-1',
    );
    expect(importedTxRepo.findPendingByIds).not.toHaveBeenCalled();
  });

  it('scopes an explicit selection to the same user', async () => {
    importedTxRepo.findPendingByIds.mockResolvedValue([]);

    await importService.buildReconciliationPlan('imp-1', 'user-1', [
      'r1',
      'r2',
    ]);

    expect(importedTxRepo.findPendingByIds).toHaveBeenCalledWith(
      'imp-1',
      ['r1', 'r2'],
      'user-1',
    );
    expect(importedTxRepo.findPendingByImportId).not.toHaveBeenCalled();
  });
});

describe('batchApproveImportedTransactions', () => {
  it('reports a stale id as a failure instead of shrinking the total', async () => {
    importedTxRepo.findPendingByIds.mockResolvedValue([pendingRow()]);

    const result = await importService.batchApproveImportedTransactions(
      'imp-1',
      'user-1',
      ['r1', 'already-approved-elsewhere'],
    );

    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual([
      {
        id: 'already-approved-elsewhere',
        error: 'Not found, not pending, or not in this import',
      },
    ]);
  });

  it('fails only the row a concurrent action took, and applies the rest', async () => {
    importedTxRepo.findPendingByIds.mockResolvedValue([
      pendingRow({ id: 'r1' }),
      pendingRow({ id: 'r2' }),
    ]);
    prismaMock.$transaction.mockRejectedValueOnce({
      code: 'P2025',
      meta: { modelName: 'ImportedTransaction' },
    });

    const result = await importService.batchApproveImportedTransactions(
      'imp-1',
      'user-1',
      ['r1', 'r2'],
    );

    expect(result).toEqual({
      total: 2,
      succeeded: 1,
      failed: 1,
      errors: [
        { id: 'r1', error: 'Imported transaction is no longer pending' },
      ],
    });
    expect(txService.notifyTransactionsCreatedSafe).toHaveBeenCalledWith(
      ['created-1'],
      'user-1',
    );
  });

  it('reports every id as succeeded when none are stale', async () => {
    importedTxRepo.findPendingByIds.mockResolvedValue([
      pendingRow({ id: 'r1' }),
      pendingRow({ id: 'r2' }),
    ]);

    const result = await importService.batchApproveImportedTransactions(
      'imp-1',
      'user-1',
      ['r1', 'r2'],
    );

    expect(result).toEqual({
      total: 2,
      succeeded: 2,
      failed: 0,
      errors: [],
    });
  });
});

describe('batchIgnoreImportedTransactions', () => {
  it('reports a stale id as a failure instead of shrinking the total', async () => {
    importedTxRepo.findPendingByIds.mockResolvedValue([{ id: 'r1' }]);
    importedTxRepo.updateStatusBatch.mockResolvedValue(1);

    const result = await importService.batchIgnoreImportedTransactions(
      'imp-1',
      'user-1',
      ['r1', 'already-approved-elsewhere'],
    );

    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual([
      {
        id: 'already-approved-elsewhere',
        error: 'Not found, not pending, or not in this import',
      },
    ]);
    expect(importedTxRepo.updateStatusBatch).toHaveBeenCalledWith(
      ['r1'],
      'user-1',
      'IGNORED',
    );
  });

  it("ignores every currently-pending row when 'all' is requested", async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([
      { id: 'r1' },
      { id: 'r2' },
    ]);
    importedTxRepo.updateStatusBatch.mockResolvedValue(2);

    const result = await importService.batchIgnoreImportedTransactions(
      'imp-1',
      'user-1',
      'all',
    );

    expect(result).toEqual({
      total: 2,
      succeeded: 2,
      failed: 0,
      errors: [],
    });
    expect(importedTxRepo.findPendingByIds).not.toHaveBeenCalled();
  });
});

describe('a batch applies the rows it already loaded', () => {
  const pendingMatch = {
    id: 'tx-1',
    userId: 'user-1',
    description: 'Coffee',
    categoryId: 'cat-1',
    status: 'PENDING_APPROVAL',
  };

  const loadedRow = (over: Record<string, unknown> = {}) => ({
    ...pendingRow(),
    matchingTransactionId: null,
    ...over,
  });

  it('merges from the joined transaction instead of re-reading it', async () => {
    importedTxRepo.findPendingByIds.mockResolvedValue([
      loadedRow({
        id: 'r1',
        matchingTransactionId: 'tx-1',
        matchingTransaction: pendingMatch,
      }),
    ]);

    const result = await importService.batchApproveImportedTransactions(
      'imp-1',
      'user-1',
      ['r1'],
    );

    expect(result.succeeded).toBe(1);
    expect(importedTxRepo.findById).not.toHaveBeenCalled();
    expect(updateTransactionOp).toHaveBeenCalledWith(
      'tx-1',
      expect.objectContaining({ status: 'APPROVED' }),
      'user-1',
    );
    expect(updateStatusOp).toHaveBeenCalledWith('r1', 'user-1', 'MERGED');
    expect(createTransactionOp).not.toHaveBeenCalled();
    expect(txService.notifyTransactionsCreatedSafe).toHaveBeenCalledWith(
      ['tx-1'],
      'user-1',
    );
  });

  it('creates for an unmatched row and marks it approved', async () => {
    importedTxRepo.findPendingByIds.mockResolvedValue([
      loadedRow({ id: 'r1' }),
    ]);

    const result = await importService.batchApproveImportedTransactions(
      'imp-1',
      'user-1',
      ['r1'],
    );

    expect(result.succeeded).toBe(1);
    expect(createTransactionOp).toHaveBeenCalledTimes(1);
    expect(markApprovedOp).toHaveBeenCalledWith('r1', 'user-1');
    expect(updateTransactionOp).not.toHaveBeenCalled();
    expect(txService.notifyTransactionsCreatedSafe).toHaveBeenCalledWith(
      ['created-1'],
      'user-1',
    );
  });

  it('hands the whole batch to one notification call', async () => {
    importedTxRepo.findPendingByIds.mockResolvedValue([
      loadedRow({ id: 'r1' }),
      loadedRow({ id: 'r2' }),
      loadedRow({ id: 'r3' }),
    ]);

    await importService.batchApproveImportedTransactions('imp-1', 'user-1', [
      'r1',
      'r2',
      'r3',
    ]);

    expect(txService.notifyTransactionsCreatedSafe).toHaveBeenCalledTimes(1);
    expect(txService.notifyTransactionCreatedSafe).not.toHaveBeenCalled();
  });
});

describe('single-row approve, merge and ignore', () => {
  const approve = () =>
    importService.approveImportedTransaction('r1', 'user-1', {
      description: 'Coffee',
      value: 12.5,
      date: new Date(2026, 2, 7),
      type: 'EXPENSE',
      categoryId: null,
    });

  const merge = () =>
    importService.mergeImportedTransaction('r1', 'user-1', {
      description: 'Coffee',
      value: 12.5,
      date: new Date(2026, 2, 7),
      type: 'EXPENSE',
    });

  const ignore = () => importService.ignoreImportedTransaction('r1', 'user-1');

  it('409s for a row that is no longer pending, before writing', async () => {
    importedTxRepo.findById.mockResolvedValue(
      pendingRow({ status: 'APPROVED', deleted: false }),
    );

    await expect(approve()).rejects.toMatchObject({ status: 409 });
    await expect(merge()).rejects.toMatchObject({ status: 409 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('404s for a deleted row', async () => {
    importedTxRepo.findById.mockResolvedValue(pendingRow({ deleted: true }));

    await expect(approve()).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('409s when a concurrent action takes the row between the read and the write', async () => {
    importedTxRepo.findById.mockResolvedValue(
      pendingRow({
        deleted: false,
        matchingTransactionId: 'tx-1',
        matchingTransaction: { id: 'tx-1', userId: 'user-1' },
      }),
    );
    const lostRace = {
      code: 'P2025',
      meta: { modelName: 'ImportedTransaction' },
    };
    prismaMock.$transaction.mockRejectedValue(lostRace);
    importedTxRepo.updateStatus.mockRejectedValueOnce(lostRace);

    await expect(approve()).rejects.toMatchObject({ status: 409 });
    await expect(merge()).rejects.toMatchObject({ status: 409 });
    await expect(ignore()).rejects.toMatchObject({ status: 409 });
  });

  it('404s a merge whose matched transaction vanished inside the batch', async () => {
    importedTxRepo.findById.mockResolvedValue(
      pendingRow({
        deleted: false,
        matchingTransactionId: 'tx-1',
        matchingTransaction: { id: 'tx-1', userId: 'user-1' },
      }),
    );
    prismaMock.$transaction.mockRejectedValue({
      code: 'P2025',
      meta: { modelName: 'Transaction' },
    });

    await expect(merge()).rejects.toMatchObject({
      status: 404,
      message: 'Transaction not found',
    });
  });

  it('409s ignoring a row that is no longer pending, before writing', async () => {
    importedTxRepo.findById.mockResolvedValue(
      pendingRow({ status: 'IGNORED', deleted: false }),
    );

    await expect(ignore()).rejects.toMatchObject({ status: 409 });
    expect(importedTxRepo.updateStatus).not.toHaveBeenCalled();
  });
});

describe('applyAutoApproveRules', () => {
  it('applies a rule only to rows of its own type', async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([
      pendingRow({ id: 'r1', description: 'Salary ACME', type: 'EXPENSE' }),
      pendingRow({ id: 'r2', description: 'Salary ACME', type: 'INCOME' }),
    ]);
    autoApproveRuleRepo.findActiveByUserId.mockResolvedValue([
      { descriptionPattern: 'salary', categoryId: 'cat-1', type: 'INCOME' },
    ]);

    const result = await importService.applyAutoApproveRules('imp-1', 'user-1');

    expect(result.total).toBe(1);
    expect(markApprovedOp).toHaveBeenCalledTimes(1);
    expect(markApprovedOp).toHaveBeenCalledWith('r2', 'user-1');
  });
});
