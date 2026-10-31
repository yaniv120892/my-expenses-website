import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import type * as ObservabilityModule from '@/server/observability';

const {
  importRepo,
  importedTxRepo,
  prismaMock,
  agentClient,
  reportError,
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
    transitionStatus: vi.fn(),
    create: vi.fn(),
    softDeleteOp: vi.fn(),
    recordExtractionRequestIdIfUnclaimed: vi.fn(),
    markFailedIfUnclaimed: vi.fn(),
  },
  importedTxRepo: {
    findById: vi.fn(),
    findByImportWithMatch: vi.fn(),
    findByImportId: vi.fn(),
    findPendingByImportId: vi.fn(),
    findPendingByIds: vi.fn(),
    findClaimedMatchingTransactionIds: vi.fn(),
    softDeleteByImportIdOp: vi.fn(),
    updateStatusBatch: vi.fn(),
    updateStatus: vi.fn(),
    softDelete: vi.fn(),
    clearPendingMatches: vi.fn(),
    setMatchingTransaction: vi.fn(),
  },
  prismaMock: {
    $transaction: vi.fn(),
  },
  agentClient: { submitExtractionRequest: vi.fn() },
  reportError: vi.fn(),
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
  autoApproveRuleRepo: { findActiveByHousehold: vi.fn() },
}));

const activity = vi.hoisted(() => {
  const entries: unknown[] = [];
  return { entries };
});
vi.mock('@/server/services/householdActivityService', async () =>
  (await import('@/test/householdActivity')).householdActivityModule(activity.entries),
);
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
vi.mock('@/server/observability', async (importOriginal) => ({
  ...(await importOriginal<typeof ObservabilityModule>()),
  observability: { reportError },
}));

import { importService } from '@/server/services/importService';
import { logger } from '@/server/observability';
import type { AIProvider } from '@/server/services/ai/aiProvider';
import { firstInvocationOrder } from '@/test/mocks';
import { testMemberActor } from '@/test/memberActor';

const actor = testMemberActor({ userId: 'user-1' });
const HOUSEHOLD = actor.householdId;

// Matching is stubbed to keep these cases on orchestration; the real method has
// its own describe below.
const originalMatchSingleTransaction = importService['matchSingleTransaction'];

const matchSingleTransaction = vi.fn();

type MatchInput = Parameters<(typeof importService)['matchSingleTransaction']>[1];

const matchableRow = (over: Partial<MatchInput> = {}): MatchInput => ({
  id: 'r1',
  description: 'Coffee',
  date: new Date(2026, 2, 7),
  value: 10,
  type: 'EXPENSE',
  currency: 'ILS',
  originalAmount: 10,
  ...over,
});

function excludedIdsOfCall(callIndex: number): string[] {
  const excluded: unknown = matchSingleTransaction.mock.calls[callIndex]?.[2];
  if (!(excluded instanceof Set)) {
    throw new Error(`matchSingleTransaction call ${callIndex} passed no exclusion set`);
  }
  return [...excluded].map(String);
}

const pendingRow = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  householdId: HOUSEHOLD,
  userId: 'user-1',
  status: 'PENDING',
  description: 'Coffee',
  value: 12.5,
  currency: 'ILS',
  originalAmount: 12.5,
  exchangeRate: null,
  exchangeRateDate: null,
  exchangeRateSource: null,
  date: new Date(2026, 2, 7),
  type: 'EXPENSE',
  matchingTransaction: null,
  ...over,
});

const row = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  householdId: HOUSEHOLD,
  status: 'PENDING',
  matchingTransactionId: null,
  description: 'Coffee',
  date: new Date(2026, 2, 7),
  value: 10,
  type: 'EXPENSE',
  currency: 'ILS',
  originalAmount: 10,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  activity.entries.length = 0;
  process.env.IMPORTS_S3_BUCKET = 'bucket';
  process.env.IMPORTS_S3_REGION = 'us-east-1';
  importRepo.findById.mockResolvedValue({
    id: 'imp-1',
    householdId: HOUSEHOLD,
    userId: 'user-1',
    deleted: false,
    status: 'COMPLETED',
  });
  importRepo.transitionStatus.mockResolvedValue(true);
  importedTxRepo.findByImportWithMatch.mockResolvedValue([row()]);
  importedTxRepo.findByImportId.mockResolvedValue([row()]);
  importedTxRepo.findClaimedMatchingTransactionIds.mockResolvedValue([]);
  matchSingleTransaction.mockResolvedValue(null);
  importService['matchSingleTransaction'] = matchSingleTransaction;
  txService.prepareCreateTransaction.mockResolvedValue({ id: 'model' });
  prismaMock.$transaction.mockResolvedValue([{ id: 'created-1' }]);
});

describe('rematchImport', () => {
  const run = () => importService.rematchImport(actor, 'imp-1');

  it("404s for an import missing from the actor's household, or deleted", async () => {
    // The repository scopes the read by household, so a foreign import is null.
    importRepo.findById.mockResolvedValue(null);
    await expect(run()).rejects.toMatchObject({ status: 404 });
    expect(importRepo.findById).toHaveBeenCalledWith(HOUSEHOLD, 'imp-1');
    expect(importRepo.transitionStatus).not.toHaveBeenCalled();

    importRepo.findById.mockResolvedValue({
      id: 'imp-1',
      householdId: HOUSEHOLD,
      userId: 'user-1',
      deleted: true,
    });
    await expect(run()).rejects.toMatchObject({ status: 404 });
  });

  it('409s unless the import is COMPLETED', async () => {
    importRepo.findById.mockResolvedValue({
      id: 'imp-1',
      householdId: HOUSEHOLD,
      userId: 'user-1',
      deleted: false,
      status: 'PROCESSING',
    });
    await expect(run()).rejects.toMatchObject({ status: 409 });
    expect(importRepo.transitionStatus).not.toHaveBeenCalled();
  });

  it('409s, touching nothing, when a concurrent call moved the import out of COMPLETED first', async () => {
    importRepo.transitionStatus.mockResolvedValueOnce(false);

    await expect(run()).rejects.toMatchObject({ status: 409 });

    expect(importRepo.transitionStatus).toHaveBeenCalledTimes(1);
    expect(importedTxRepo.findByImportWithMatch).not.toHaveBeenCalled();
    expect(importedTxRepo.clearPendingMatches).not.toHaveBeenCalled();
  });

  it('reads the rows only after claiming the import', async () => {
    await run();

    expect(firstInvocationOrder(importRepo.transitionStatus)).toBeLessThan(
      firstInvocationOrder(importedTxRepo.findByImportWithMatch),
    );
  });

  it('409s when nothing is pending, and hands the import back', async () => {
    importedTxRepo.findByImportWithMatch.mockResolvedValue([row({ status: 'APPROVED' })]);
    await expect(run()).rejects.toMatchObject({ status: 409 });
    expect(importRepo.transitionStatus.mock.calls).toEqual([
      [HOUSEHOLD, 'imp-1', 'COMPLETED', 'REMATCHING'],
      [HOUSEHOLD, 'imp-1', 'REMATCHING', 'COMPLETED'],
    ]);
    expect(importedTxRepo.clearPendingMatches).not.toHaveBeenCalled();
  });

  it('clears pending matches, re-matches, and returns to COMPLETED', async () => {
    await run();

    expect(importedTxRepo.findByImportWithMatch).toHaveBeenCalledWith(HOUSEHOLD, 'imp-1');
    expect(importedTxRepo.findClaimedMatchingTransactionIds).toHaveBeenCalledWith(HOUSEHOLD);
    expect(matchSingleTransaction.mock.calls[0]?.[0]).toBe(HOUSEHOLD);

    expect(importRepo.transitionStatus.mock.calls[0]).toEqual([
      HOUSEHOLD,
      'imp-1',
      'COMPLETED',
      'REMATCHING',
    ]);
    expect(importedTxRepo.clearPendingMatches).toHaveBeenCalledWith(HOUSEHOLD, 'imp-1');
    expect(importRepo.transitionStatus.mock.calls[1]).toEqual([
      HOUSEHOLD,
      'imp-1',
      'REMATCHING',
      'COMPLETED',
    ]);
  });

  it('excludes transactions already claimed by non-pending rows', async () => {
    importedTxRepo.findByImportWithMatch.mockResolvedValue([
      row(),
      row({ id: 'r2', status: 'APPROVED', matchingTransactionId: 'tx-taken' }),
      row({ id: 'r3', status: 'IGNORED', matchingTransactionId: null }),
    ]);

    await run();

    expect(matchSingleTransaction).toHaveBeenCalledTimes(1);
    expect(excludedIdsOfCall(0)).toEqual(['tx-taken']);
  });

  it("excludes transactions another import's pending rows claim", async () => {
    importedTxRepo.findClaimedMatchingTransactionIds.mockResolvedValue(['tx-other-import']);

    await run();
    expect(excludedIdsOfCall(0)).toEqual(['tx-other-import']);
    expect(firstInvocationOrder(importedTxRepo.clearPendingMatches)).toBeLessThan(
      firstInvocationOrder(importedTxRepo.findClaimedMatchingTransactionIds),
    );
  });

  it('a match found mid-run is excluded from later rows', async () => {
    importedTxRepo.findByImportWithMatch.mockResolvedValue([row(), row({ id: 'r2' })]);
    matchSingleTransaction.mockResolvedValueOnce('tx-a');

    await run();
    expect(excludedIdsOfCall(1)).toEqual(['tx-a']);
  });

  it('one failing row does not abort the rest, and the import completes', async () => {
    importedTxRepo.findByImportWithMatch.mockResolvedValue([row(), row({ id: 'r2' })]);
    matchSingleTransaction.mockRejectedValueOnce(new Error('boom'));

    await run();

    expect(matchSingleTransaction).toHaveBeenCalledTimes(2);
    expect(importRepo.transitionStatus.mock.calls[1]).toEqual([
      HOUSEHOLD,
      'imp-1',
      'REMATCHING',
      'COMPLETED',
    ]);
  });

  describe('when it fails', () => {
    let status: string;

    beforeEach(() => {
      status = 'COMPLETED';
      importRepo.findById.mockImplementation(async () => ({
        id: 'imp-1',
        householdId: HOUSEHOLD,
        userId: 'user-1',
        deleted: false,
        status,
      }));
      importRepo.transitionStatus.mockImplementation(
        async (_householdId: string, _id: string, from: string, to: string) => {
          if (status !== from) {
            return false;
          }
          status = to;
          return true;
        },
      );
    });

    it('returns the import to COMPLETED, so a retry can re-match it', async () => {
      importedTxRepo.clearPendingMatches.mockRejectedValueOnce(new Error('db down'));

      await expect(run()).rejects.toThrow('db down');
      expect(status).toBe('COMPLETED');
      expect(importRepo.updateStatus).not.toHaveBeenCalled();

      await run();
      expect(matchSingleTransaction).toHaveBeenCalledTimes(1);
      expect(status).toBe('COMPLETED');
    });

    it('retries handing back a re-match that succeeded', async () => {
      importRepo.transitionStatus
        .mockResolvedValueOnce(true)
        .mockRejectedValueOnce(new Error('blip'))
        .mockResolvedValueOnce(true);

      await expect(run()).rejects.toThrow('blip');
      expect(importRepo.transitionStatus.mock.calls).toEqual([
        [HOUSEHOLD, 'imp-1', 'COMPLETED', 'REMATCHING'],
        [HOUSEHOLD, 'imp-1', 'REMATCHING', 'COMPLETED'],
        [HOUSEHOLD, 'imp-1', 'REMATCHING', 'COMPLETED'],
      ]);
    });

    it('keeps the re-match error when handing the import back fails too', async () => {
      importedTxRepo.clearPendingMatches.mockRejectedValueOnce(new Error('db down'));
      importRepo.transitionStatus
        .mockImplementationOnce(async () => {
          status = 'REMATCHING';
          return true;
        })
        .mockRejectedValueOnce(new Error('still down'));

      await expect(run()).rejects.toThrow('db down');
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.any(String),
          context: expect.objectContaining({ importId: 'imp-1' }),
        }),
      );
    });
  });
});

describe('processImport', () => {
  const url = 'https://bucket.s3.us-east-1.amazonaws.com/imports/f.xlsx';
  const run = (fileUrl = url) => importService.processImport(actor, fileUrl, 'f.xlsx', '03/2026');

  beforeEach(() => {
    importRepo.create.mockResolvedValue({ id: 'imp-1', originalFileName: 'f.xlsx' });
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
    expect(result).toEqual({ id: 'imp-1', originalFileName: 'f.xlsx' });
    expect(activity.entries).toEqual([
      { action: 'CREATE', entityType: 'IMPORT', entityId: 'imp-1', summary: 'f.xlsx' },
    ]);
    expect(importRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ householdId: HOUSEHOLD, userId: 'user-1' }),
    );
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
    // The callback may already have completed the import, so the status is not
    // re-stated.
    expect(importRepo.updateStatus).not.toHaveBeenCalled();
    expect(importRepo.recordExtractionRequestIdIfUnclaimed).toHaveBeenCalledWith(
      HOUSEHOLD,
      'imp-1',
      'req-9',
    );
  });

  it('a rejected submit marks the import FAILED and rethrows', async () => {
    agentClient.submitExtractionRequest.mockRejectedValue(new Error('agent down'));
    await expect(run()).rejects.toThrow('agent down');
    expect(importRepo.markFailedIfUnclaimed).toHaveBeenCalledWith(HOUSEHOLD, 'imp-1', 'agent down');
  });

  it('a failed create never reaches the agent', async () => {
    importRepo.create.mockRejectedValue(new Error('insert failed'));
    await expect(run()).rejects.toThrow('insert failed');
    expect(agentClient.submitExtractionRequest).not.toHaveBeenCalled();
  });

  it('logs the extension, never the file name, even from an older name-bearing key', async () => {
    const info = vi.spyOn(logger, 'info');
    onTestFinished(() => info.mockRestore());
    const olderUrl =
      'https://bucket.s3.us-east-1.amazonaws.com/imports/uuid-Leumi_statement_March.xlsx';

    await importService.processImport(actor, olderUrl, 'Leumi statement March.xlsx', '03/2026');

    expect(JSON.stringify(info.mock.calls)).not.toMatch(/Leumi|statement|March/);
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ fileExtension: '.xlsx' }),
      'Starting import with excel extraction agent',
    );
  });
});

describe('findPotentialMatchesForImport', () => {
  const run = () => importService.findPotentialMatchesForImport(HOUSEHOLD, 'imp-1');

  /**
   * The exclusion set is one mutable Set shared across calls, so it has to be
   * snapshotted as each call happens rather than read back afterwards.
   */
  const recordExclusions = (matchIds: (string | null)[]) => {
    const seen: string[][] = [];
    let call = 0;
    matchSingleTransaction.mockImplementation(
      async (_householdId: string, _tx: unknown, excluded: Set<string>) => {
        seen.push([...excluded]);
        return matchIds[call++] ?? null;
      },
    );
    return seen;
  };

  it('excludes transactions already claimed by another import', async () => {
    importedTxRepo.findClaimedMatchingTransactionIds.mockResolvedValue(['tx-taken']);
    const seen = recordExclusions([]);

    await run();

    expect(importedTxRepo.findByImportId).toHaveBeenCalledWith(HOUSEHOLD, 'imp-1');
    expect(importedTxRepo.findClaimedMatchingTransactionIds).toHaveBeenCalledWith(HOUSEHOLD);
    expect(matchSingleTransaction.mock.calls[0]?.[0]).toBe(HOUSEHOLD);
    expect(seen[0]).toEqual(['tx-taken']);
  });

  it('never offers one transaction to two rows of the same import', async () => {
    importedTxRepo.findByImportId.mockResolvedValue([row({ id: 'r1' }), row({ id: 'r2' })]);
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
    expect(matchSingleTransaction.mock.calls[0]?.[1]).toMatchObject({ id: 'r2' });
  });

  it('leaves an approved or ignored row alone even though it holds no match', async () => {
    importedTxRepo.findByImportId.mockResolvedValue([
      row({ id: 'r1', status: 'APPROVED' }),
      row({ id: 'r2', status: 'IGNORED' }),
      row({ id: 'r3' }),
    ]);

    await run();

    expect(matchSingleTransaction).toHaveBeenCalledTimes(1);
    expect(matchSingleTransaction.mock.calls[0]?.[1]).toMatchObject({ id: 'r3' });
  });

  it('keeps matching the remaining rows when one row throws', async () => {
    importedTxRepo.findByImportId.mockResolvedValue([row({ id: 'r1' }), row({ id: 'r2' })]);
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
      type: 'EXPENSE',
      status: 'APPROVED',
      bankDescriptionPrefix: null,
    },
    {
      id: 'tx-b',
      description: 'Bakery',
      date: new Date(2026, 2, 7),
      value: 10,
      type: 'EXPENSE',
      status: 'APPROVED',
      bankDescriptionPrefix: null,
    },
  ];

  // Spelled like neither candidate, so the model decides.
  const ambiguousRow = () => matchableRow({ description: 'Coffee Shop' });

  const originalGetAiProvider = importService['getAiProvider'];
  const matchingProvider: AIProvider = {
    generateContent: vi.fn(),
    analyzeExpenses: vi.fn(),
    findMatchingTransaction,
    suggestCategory: vi.fn(),
    evaluateCategory: vi.fn(),
    modelName: () => 'test-model',
  };

  beforeEach(() => {
    // The file-level beforeEach stubs the method; this describe wants the
    // real one, with the provider stubbed at its instance getter instead.
    importService['matchSingleTransaction'] = originalMatchSingleTransaction;
    importService['getAiProvider'] = () => matchingProvider;
    findPotentialMatches.mockResolvedValue(candidates);
  });

  afterEach(() => {
    // Direct property assignment survives vi.clearAllMocks; restore so no
    // later describe inherits the override.
    importService['getAiProvider'] = originalGetAiProvider;
  });

  it('stores the id the provider validated', async () => {
    findMatchingTransaction.mockResolvedValue('tx-b');

    const matched = await importService['matchSingleTransaction'](HOUSEHOLD, ambiguousRow());

    expect(matched).toBe('tx-b');
    expect(importedTxRepo.setMatchingTransaction).toHaveBeenCalledWith(HOUSEHOLD, 'r1', 'tx-b');
  });

  it("gives the provider the row's amount, date and type, not just its description", async () => {
    findMatchingTransaction.mockResolvedValue(null);

    await importService['matchSingleTransaction'](
      HOUSEHOLD,
      matchableRow({ description: 'Coffee Shop', type: 'EXPENSE' }),
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

    const matched = await importService['matchSingleTransaction'](HOUSEHOLD, ambiguousRow());

    expect(matched).toBeNull();
    expect(importedTxRepo.setMatchingTransaction).not.toHaveBeenCalled();
  });

  it('asks only for candidates of the same direction', async () => {
    await importService['matchSingleTransaction'](HOUSEHOLD, matchableRow({ type: 'EXPENSE' }));

    expect(findPotentialMatches).toHaveBeenCalledWith(
      HOUSEHOLD,
      expect.objectContaining({
        date: new Date(2026, 2, 7),
        value: 10,
        type: 'EXPENSE',
      }),
    );
  });

  it('claims an unambiguous spelling match without calling the provider', async () => {
    const matched = await importService['matchSingleTransaction'](HOUSEHOLD, matchableRow());

    expect(matched).toBe('tx-a');
    expect(findMatchingTransaction).not.toHaveBeenCalled();
    expect(importedTxRepo.setMatchingTransaction).toHaveBeenCalledWith(HOUSEHOLD, 'r1', 'tx-a');
  });

  describe('a variable-amount placeholder', () => {
    const placeholder = (over: Record<string, unknown> = {}) => ({
      id: 'tx-google',
      description: 'גוגל אחסון',
      date: new Date(2026, 2, 2),
      value: 8,
      type: 'EXPENSE',
      status: 'PENDING_APPROVAL',
      bankDescriptionPrefix: 'google',
      ...over,
    });

    it('claims it at any amount when the prefix fits, without the provider', async () => {
      findPotentialMatches.mockResolvedValue([placeholder()]);

      const matched = await importService['matchSingleTransaction'](
        HOUSEHOLD,
        matchableRow({ description: 'GOOGLE CLOUD EMEA', value: 101.98 }),
      );

      expect(matched).toBe('tx-google');
      expect(findMatchingTransaction).not.toHaveBeenCalled();
      expect(importedTxRepo.setMatchingTransaction).toHaveBeenCalledWith(
        HOUSEHOLD,
        'r1',
        'tx-google',
      );
    });

    it('takes the one nearest in date when several fit', async () => {
      findPotentialMatches.mockResolvedValue([
        placeholder({ id: 'far', date: new Date(2026, 2, 11) }),
        placeholder({ id: 'near', date: new Date(2026, 2, 6) }),
      ]);

      const matched = await importService['matchSingleTransaction'](
        HOUSEHOLD,
        matchableRow({ description: 'GOOGLE', value: 3 }),
      );

      expect(matched).toBe('near');
    });

    it('leaves the row to the model when another candidate also fits, so a hand-logged charge is not doubled', async () => {
      const handLogged = {
        ...candidates[0],
        id: 'tx-hand',
        description: 'Google storage',
        value: 101.98,
      };
      findPotentialMatches.mockResolvedValue([placeholder(), handLogged]);
      findMatchingTransaction.mockResolvedValue('tx-hand');

      const matched = await importService['matchSingleTransaction'](
        HOUSEHOLD,
        matchableRow({ description: 'GOOGLE CLOUD EMEA', value: 101.98 }),
      );

      expect(matched).toBe('tx-hand');
      expect(findMatchingTransaction).toHaveBeenCalledWith(expect.anything(), [handLogged]);
    });

    it('falls back to the placeholder when the model takes none of the others', async () => {
      findPotentialMatches.mockResolvedValue([
        placeholder(),
        { ...candidates[0], id: 'tx-other', value: 101.98 },
      ]);
      findMatchingTransaction.mockResolvedValue(null);

      const matched = await importService['matchSingleTransaction'](
        HOUSEHOLD,
        matchableRow({ description: 'GOOGLE CLOUD EMEA', value: 101.98 }),
      );

      expect(matched).toBe('tx-google');
    });

    it('prefers the most specific prefix over a nearer, broader one', async () => {
      findPotentialMatches.mockResolvedValue([
        placeholder({ id: 'broad', date: new Date(2026, 2, 7) }),
        placeholder({
          id: 'specific',
          date: new Date(2026, 2, 10),
          bankDescriptionPrefix: 'google cloud',
        }),
      ]);

      const matched = await importService['matchSingleTransaction'](
        HOUSEHOLD,
        matchableRow({ description: 'GOOGLE CLOUD EMEA', value: 101.98 }),
      );

      expect(matched).toBe('specific');
    });

    it('is never a candidate for a charge the prefix does not start', async () => {
      findPotentialMatches.mockResolvedValue([
        placeholder({ value: 10, bankDescriptionPrefix: 'google' }),
      ]);

      const matched = await importService['matchSingleTransaction'](HOUSEHOLD, matchableRow());

      expect(matched).toBeNull();
      expect(findMatchingTransaction).not.toHaveBeenCalled();
    });

    it('matches by value again once approved', async () => {
      findPotentialMatches.mockResolvedValue([placeholder({ status: 'APPROVED' })]);

      const matched = await importService['matchSingleTransaction'](
        HOUSEHOLD,
        matchableRow({ description: 'GOOGLE CLOUD EMEA', value: 101.98 }),
      );

      expect(matched).toBeNull();
    });
  });

  it('defers to the provider when two candidates share a spelling', async () => {
    findPotentialMatches.mockResolvedValue([
      candidates[0],
      { ...candidates[1], description: 'coffee!' },
    ]);
    findMatchingTransaction.mockResolvedValue('tx-b');

    const matched = await importService['matchSingleTransaction'](HOUSEHOLD, matchableRow());

    expect(matched).toBe('tx-b');
    expect(findMatchingTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('buildReconciliationPlan', () => {
  const matchedTransaction = {
    id: 'tx-1',
    description: 'Coffee at the corner',
    value: 11,
    currency: 'ILS',
    originalAmount: 11,
    exchangeRate: null,
    exchangeRateDate: null,
    exchangeRateSource: null,
    date: new Date(2026, 2, 5),
    status: 'PENDING_APPROVAL',
    categoryId: 'category-1',
  };

  const pendingRow = (over: Record<string, unknown> = {}) => ({
    id: 'r1',
    householdId: HOUSEHOLD,
    userId: 'user-1',
    status: 'PENDING',
    description: 'Coffee',
    value: 12.5,
    currency: 'ILS',
    originalAmount: over.value ?? 12.5,
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

    const plan = await importService.buildReconciliationPlan(HOUSEHOLD, 'imp-1');

    expect(plan).toEqual([
      {
        importedTransactionId: 'r1',
        action: 'CREATE',
        description: 'Coffee',
        value: 12.5,
        currency: 'ILS',
        originalAmount: 12.5,
        date: new Date(2026, 2, 7),
        type: 'EXPENSE',
        categoryId: null,
        match: null,
        reviewHint: null,
        cardHoldingFee: false,
      },
    ]);
  });

  it('flags a card-holding fee row without querying or asking the model', async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([
      pendingRow({ description: 'דמי כרטיס /הנפקה', value: 22.9 }),
      pendingRow({ id: 'r2', description: 'דמי לידה', value: 22.9 }),
    ]);

    const plan = await importService.buildReconciliationPlan(HOUSEHOLD, 'imp-1');

    expect(plan.map((item) => item.cardHoldingFee)).toEqual([true, false]);
    expect(findMatchingTransaction).not.toHaveBeenCalled();
  });

  it('flags a CREATE whose window holds an unclaimed transaction', async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([
      pendingRow({ value: 470, date: new Date(2026, 5, 16) }),
    ]);
    findPotentialMatchesForCharges.mockResolvedValue([candidateTransaction({ id: 'tx-bruno' })]);

    const [item] = await importService.buildReconciliationPlan(HOUSEHOLD, 'imp-1');

    expect(item?.action).toBe('CREATE');
    expect(item?.reviewHint).toMatchObject({
      reason: 'unmatched-candidate',
      counterpart: { transactionId: 'tx-bruno' },
      candidateCount: 1,
    });
    expect(findPotentialMatchesForCharges).toHaveBeenCalledTimes(1);
    expect(findPotentialMatchesForCharges).toHaveBeenCalledWith(HOUSEHOLD, expect.any(Array));
    expect(importedTxRepo.findClaimedMatchingTransactionIds).toHaveBeenCalledWith(HOUSEHOLD);
  });

  it('does not flag a candidate another pending row already claims', async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([
      pendingRow({ value: 470, date: new Date(2026, 5, 16) }),
    ]);
    findPotentialMatchesForCharges.mockResolvedValue([candidateTransaction({ id: 'tx-claimed' })]);
    importedTxRepo.findClaimedMatchingTransactionIds.mockResolvedValue(['tx-claimed']);

    const [item] = await importService.buildReconciliationPlan(HOUSEHOLD, 'imp-1');

    expect(item?.reviewHint).toBeNull();
  });

  it('flags an unrelated MERGE without querying for candidates', async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([
      pendingRow({
        description: 'Pet shop',
        matchingTransaction: matchedTransaction,
      }),
    ]);

    const [item] = await importService.buildReconciliationPlan(HOUSEHOLD, 'imp-1');

    expect(item?.action).toBe('MERGE');
    expect(item?.reviewHint).toEqual({ reason: 'unrelated-merge' });
    expect(findPotentialMatchesForCharges).not.toHaveBeenCalled();
  });

  it('plans a MERGE carrying the diff the commit would write', async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([
      pendingRow({ matchingTransaction: matchedTransaction }),
    ]);

    const [item] = await importService.buildReconciliationPlan(HOUSEHOLD, 'imp-1');

    expect(item?.action).toBe('MERGE');
    expect(item?.categoryId).toBe('category-1');
    expect(item?.match).toEqual({
      transactionId: 'tx-1',
      approvesPendingTransaction: true,
      matchedByBankDescriptionPrefix: false,
      before: {
        description: 'Coffee at the corner',
        value: 11,
        currency: 'ILS',
        originalAmount: 11,
        date: new Date(2026, 2, 5),
      },
    });
    expect(item?.description).toBe('Coffee');
    expect(item?.value).toBe(12.5);
    expect(item?.date).toEqual(new Date(2026, 2, 7));
  });

  it('marks a merge its schedule declared by prefix, so the preview does not call it unrelated', async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([
      pendingRow({
        description: 'GOOGLE CLOUD EMEA',
        matchingTransaction: {
          ...matchedTransaction,
          description: 'גוגל אחסון',
          scheduledTransaction: { bankDescriptionPrefix: 'google' },
        },
      }),
    ]);

    const [item] = await importService.buildReconciliationPlan(HOUSEHOLD, 'imp-1');

    expect(item?.match?.matchedByBankDescriptionPrefix).toBe(true);
    expect(item?.reviewHint).toBeNull();
  });

  it('marks a merge onto an already approved transaction as no approval', async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([
      pendingRow({
        matchingTransaction: { ...matchedTransaction, status: 'APPROVED' },
      }),
    ]);

    const [item] = await importService.buildReconciliationPlan(HOUSEHOLD, 'imp-1');

    expect(item?.match).not.toBeNull();
    expect(item?.match?.approvesPendingTransaction).toBe(false);
  });

  it("asks only for this household's pending rows in the import", async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([]);

    await importService.buildReconciliationPlan(HOUSEHOLD, 'imp-1');

    expect(importedTxRepo.findPendingByImportId).toHaveBeenCalledWith(HOUSEHOLD, 'imp-1');
    expect(importedTxRepo.findPendingByIds).not.toHaveBeenCalled();
  });

  it('scopes an explicit selection to the same household', async () => {
    importedTxRepo.findPendingByIds.mockResolvedValue([]);

    await importService.buildReconciliationPlan(HOUSEHOLD, 'imp-1', ['r1', 'r2']);

    expect(importedTxRepo.findPendingByIds).toHaveBeenCalledWith(HOUSEHOLD, 'imp-1', ['r1', 'r2']);
    expect(importedTxRepo.findPendingByImportId).not.toHaveBeenCalled();
  });
});

describe('batchApproveImportedTransactions', () => {
  it('reports a stale id as a failure instead of shrinking the total', async () => {
    importedTxRepo.findPendingByIds.mockResolvedValue([pendingRow()]);

    const result = await importService.batchApproveImportedTransactions(actor, 'imp-1', [
      'r1',
      'already-approved-elsewhere',
    ]);

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

    const result = await importService.batchApproveImportedTransactions(actor, 'imp-1', [
      'r1',
      'r2',
    ]);

    expect(result).toEqual({
      total: 2,
      succeeded: 1,
      failed: 1,
      errors: [{ id: 'r1', error: 'Imported transaction is no longer pending' }],
    });
    expect(txService.notifyTransactionsCreatedSafe).toHaveBeenCalledWith(HOUSEHOLD, ['created-1']);
  });

  it('reports every id as succeeded when none are stale', async () => {
    importedTxRepo.findPendingByIds.mockResolvedValue([
      pendingRow({ id: 'r1' }),
      pendingRow({ id: 'r2' }),
    ]);

    const result = await importService.batchApproveImportedTransactions(actor, 'imp-1', [
      'r1',
      'r2',
    ]);

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
    importedTxRepo.updateStatusBatch.mockResolvedValue([{ id: 'r1', description: 'Coffee' }]);

    const result = await importService.batchIgnoreImportedTransactions(actor, 'imp-1', [
      'r1',
      'already-approved-elsewhere',
    ]);

    expect(result.total).toBe(2);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual([
      {
        id: 'already-approved-elsewhere',
        error: 'Not found, not pending, or not in this import',
      },
    ]);
    expect(importedTxRepo.updateStatusBatch).toHaveBeenCalledWith(HOUSEHOLD, ['r1'], 'IGNORED');
  });

  it("ignores every currently-pending row when 'all' is requested", async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
    importedTxRepo.updateStatusBatch.mockResolvedValue([
      { id: 'r1', description: 'Coffee' },
      { id: 'r2', description: 'Bread' },
    ]);

    const result = await importService.batchIgnoreImportedTransactions(actor, 'imp-1', 'all');

    expect(result).toEqual({
      total: 2,
      succeeded: 2,
      failed: 0,
      errors: [],
    });
    expect(importedTxRepo.findPendingByIds).not.toHaveBeenCalled();
  });

  it('records one IGNORE per row it moved, not per row it asked for', async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
    importedTxRepo.updateStatusBatch.mockResolvedValue([{ id: 'r2', description: 'Bread' }]);

    const result = await importService.batchIgnoreImportedTransactions(actor, 'imp-1', 'all');

    expect(result).toMatchObject({ total: 2, succeeded: 1, failed: 1 });
    expect(activity.entries).toEqual([
      { action: 'IGNORE', entityType: 'IMPORTED_TRANSACTION', entityId: 'r2', summary: 'Bread' },
    ]);
  });
});

describe('a batch applies the rows it already loaded', () => {
  const pendingMatch = {
    id: 'tx-1',
    householdId: HOUSEHOLD,
    userId: 'user-1',
    description: 'Coffee',
    categoryId: 'cat-1',
    status: 'PENDING_APPROVAL',
    value: 12.5,
    currency: 'ILS',
    originalAmount: 12.5,
    exchangeRate: null,
    exchangeRateDate: null,
    exchangeRateSource: null,
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

    const result = await importService.batchApproveImportedTransactions(actor, 'imp-1', ['r1']);

    expect(result.succeeded).toBe(1);
    expect(importedTxRepo.findById).not.toHaveBeenCalled();
    expect(updateTransactionOp).toHaveBeenCalledWith(
      HOUSEHOLD,
      'tx-1',
      expect.objectContaining({ status: 'APPROVED' }),
    );
    expect(updateStatusOp).toHaveBeenCalledWith(HOUSEHOLD, 'r1', 'MERGED');
    expect(activity.entries).toEqual([
      { action: 'MERGE', entityType: 'IMPORTED_TRANSACTION', entityId: 'r1', summary: 'Coffee' },
    ]);
    expect(createTransactionOp).not.toHaveBeenCalled();
    expect(txService.notifyTransactionsCreatedSafe).toHaveBeenCalledWith(HOUSEHOLD, ['tx-1']);
  });

  it('learns a merge category under the statement description, not the hand-logged one', async () => {
    importedTxRepo.findById.mockResolvedValue(
      loadedRow({
        id: 'r1',
        deleted: false,
        description: 'AROMA TLV',
        matchingTransactionId: 'tx-1',
        matchingTransaction: { ...pendingMatch, description: 'coffee' },
      }),
    );

    await importService.mergeImportedTransaction(actor, 'r1', {
      description: 'AROMA TLV',
      value: 12.5,
      date: new Date(2026, 2, 7),
      type: 'EXPENSE',
      categoryId: 'cat-2',
    });

    expect(txService.learnCategoryMappingSafe).toHaveBeenCalledWith({
      actor,
      description: 'AROMA TLV',
      previousCategoryId: 'cat-1',
      categoryId: 'cat-2',
    });
  });

  it('creates for an unmatched row and marks it approved', async () => {
    importedTxRepo.findPendingByIds.mockResolvedValue([loadedRow({ id: 'r1' })]);

    const result = await importService.batchApproveImportedTransactions(actor, 'imp-1', ['r1']);

    expect(result.succeeded).toBe(1);
    expect(txService.prepareCreateTransaction).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ description: 'Coffee', status: 'APPROVED' }),
    );
    expect(createTransactionOp).toHaveBeenCalledTimes(1);
    expect(markApprovedOp).toHaveBeenCalledWith(HOUSEHOLD, 'r1');
    expect(updateTransactionOp).not.toHaveBeenCalled();
    expect(txService.notifyTransactionsCreatedSafe).toHaveBeenCalledWith(HOUSEHOLD, ['created-1']);
  });

  it('hands the whole batch to one notification call', async () => {
    importedTxRepo.findPendingByIds.mockResolvedValue([
      loadedRow({ id: 'r1' }),
      loadedRow({ id: 'r2' }),
      loadedRow({ id: 'r3' }),
    ]);

    await importService.batchApproveImportedTransactions(actor, 'imp-1', ['r1', 'r2', 'r3']);

    expect(activity.entries).toEqual(
      ['r1', 'r2', 'r3'].map((entityId) => ({
        action: 'APPROVE',
        entityType: 'IMPORTED_TRANSACTION',
        entityId,
        summary: 'Coffee',
      })),
    );
    expect(txService.notifyTransactionsCreatedSafe).toHaveBeenCalledTimes(1);
    expect(txService.notifyTransactionCreatedSafe).not.toHaveBeenCalled();
  });
});

describe('single-row approve, merge and ignore', () => {
  const approve = () =>
    importService.approveImportedTransaction(actor, 'r1', {
      description: 'Coffee',
      value: 12.5,
      date: new Date(2026, 2, 7),
      type: 'EXPENSE',
      categoryId: null,
    });

  const merge = () =>
    importService.mergeImportedTransaction(actor, 'r1', {
      description: 'Coffee',
      value: 12.5,
      date: new Date(2026, 2, 7),
      type: 'EXPENSE',
    });

  const ignore = () => importService.ignoreImportedTransaction(actor, 'r1');

  it('409s for a row that is no longer pending, before writing', async () => {
    importedTxRepo.findById.mockResolvedValue(pendingRow({ status: 'APPROVED', deleted: false }));

    await expect(approve()).rejects.toMatchObject({ status: 409 });
    await expect(merge()).rejects.toMatchObject({ status: 409 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('404s for a deleted row', async () => {
    importedTxRepo.findById.mockResolvedValue(pendingRow({ deleted: true }));

    await expect(approve()).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("404s for a row outside the actor's household, reading it by household", async () => {
    // The repository scopes the read by household, so a foreign row is null.
    importedTxRepo.findById.mockResolvedValue(null);

    await expect(approve()).rejects.toMatchObject({ status: 404 });
    await expect(merge()).rejects.toMatchObject({ status: 404 });
    await expect(ignore()).rejects.toMatchObject({ status: 404 });
    expect(importedTxRepo.findById).toHaveBeenCalledWith(HOUSEHOLD, 'r1');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(importedTxRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('404s a merge whose stored match belongs to another household, before writing', async () => {
    importedTxRepo.findById.mockResolvedValue(
      pendingRow({
        deleted: false,
        matchingTransactionId: 'tx-1',
        matchingTransaction: {
          id: 'tx-1',
          householdId: 'household-of-someone-else',
          value: 12.5,
          currency: 'ILS',
          originalAmount: 12.5,
        },
      }),
    );

    await expect(merge()).rejects.toMatchObject({
      status: 404,
      message: 'Matching transaction not found',
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('notifies about a single approved row in the household', async () => {
    importedTxRepo.findById.mockResolvedValue(pendingRow({ deleted: false }));

    await approve();

    expect(markApprovedOp).toHaveBeenCalledWith(HOUSEHOLD, 'r1');
    expect(activity.entries).toEqual([
      { action: 'APPROVE', entityType: 'IMPORTED_TRANSACTION', entityId: 'r1', summary: 'Coffee' },
    ]);
    expect(txService.notifyTransactionCreatedSafe).toHaveBeenCalledWith(HOUSEHOLD, 'created-1');
  });

  it('ignores a row within the household', async () => {
    importedTxRepo.findById.mockResolvedValue(pendingRow({ deleted: false }));
    importedTxRepo.updateStatus.mockResolvedValue({});

    await ignore();

    expect(importedTxRepo.updateStatus).toHaveBeenCalledWith(HOUSEHOLD, 'r1', 'IGNORED');
    expect(activity.entries).toEqual([
      { action: 'IGNORE', entityType: 'IMPORTED_TRANSACTION', entityId: 'r1', summary: 'Coffee' },
    ]);
  });

  it('409s when a concurrent action takes the row between the read and the write', async () => {
    importedTxRepo.findById.mockResolvedValue(
      pendingRow({
        deleted: false,
        matchingTransactionId: 'tx-1',
        matchingTransaction: {
          id: 'tx-1',
          householdId: HOUSEHOLD,
          userId: 'user-1',
          value: 12.5,
          currency: 'ILS',
          originalAmount: 12.5,
          exchangeRate: null,
          exchangeRateDate: null,
          exchangeRateSource: null,
        },
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
    expect(activity.entries).toEqual([]);
  });

  it('404s a merge whose matched transaction vanished inside the batch', async () => {
    importedTxRepo.findById.mockResolvedValue(
      pendingRow({
        deleted: false,
        matchingTransactionId: 'tx-1',
        matchingTransaction: {
          id: 'tx-1',
          householdId: HOUSEHOLD,
          userId: 'user-1',
          value: 12.5,
          currency: 'ILS',
          originalAmount: 12.5,
          exchangeRate: null,
          exchangeRateDate: null,
          exchangeRateSource: null,
        },
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
    importedTxRepo.findById.mockResolvedValue(pendingRow({ status: 'IGNORED', deleted: false }));

    await expect(ignore()).rejects.toMatchObject({ status: 409 });
    expect(importedTxRepo.updateStatus).not.toHaveBeenCalled();
  });
});

describe('deleteImport', () => {
  it('deletes the rows with the import in one batch, so none stays approvable', async () => {
    importRepo.softDeleteOp.mockReturnValue({ op: 'deleteImport' });
    importedTxRepo.softDeleteByImportIdOp.mockReturnValue({ op: 'deleteRows' });
    importRepo.findById.mockResolvedValue({
      id: 'imp-1',
      originalFileName: 'march.xlsx',
      deleted: false,
    });
    prismaMock.$transaction.mockResolvedValue([{ id: 'imp-1' }, { count: 3 }]);

    await importService.deleteImport(actor, 'imp-1');

    expect(activity.entries).toEqual([
      { action: 'DELETE', entityType: 'IMPORT', entityId: 'imp-1', summary: 'march.xlsx' },
    ]);

    expect(importRepo.softDeleteOp).toHaveBeenCalledWith(HOUSEHOLD, 'imp-1');
    expect(importedTxRepo.softDeleteByImportIdOp).toHaveBeenCalledWith(HOUSEHOLD, 'imp-1');
    expect(prismaMock.$transaction).toHaveBeenCalledWith([
      { op: 'deleteImport' },
      { op: 'deleteRows' },
    ]);
  });

  it('records nothing when the import was already deleted', async () => {
    importRepo.findById.mockResolvedValue({
      id: 'imp-1',
      originalFileName: 'march.xlsx',
      deleted: true,
    });
    prismaMock.$transaction.mockResolvedValue([{ id: 'imp-1' }, { count: 0 }]);

    await importService.deleteImport(actor, 'imp-1');

    expect(activity.entries).toEqual([]);
  });
});

describe('deleteImportedTransaction', () => {
  it('records nothing when the row was already deleted', async () => {
    importedTxRepo.findById.mockResolvedValue(pendingRow({ deleted: true }));

    await importService.deleteImportedTransaction(actor, 'r1');

    expect(activity.entries).toEqual([]);
  });

  it('records the deleted row under the description it had', async () => {
    importedTxRepo.findById.mockResolvedValue(pendingRow({ deleted: false }));

    await importService.deleteImportedTransaction(actor, 'r1');

    expect(importedTxRepo.softDelete).toHaveBeenCalledWith(HOUSEHOLD, 'r1');
    expect(activity.entries).toEqual([
      { action: 'DELETE', entityType: 'IMPORTED_TRANSACTION', entityId: 'r1', summary: 'Coffee' },
    ]);
  });
});

describe('applyAutoApproveRules', () => {
  it('applies a rule only to rows of its own type', async () => {
    importedTxRepo.findPendingByImportId.mockResolvedValue([
      pendingRow({ id: 'r1', description: 'Salary ACME', type: 'EXPENSE' }),
      pendingRow({ id: 'r2', description: 'Salary ACME', type: 'INCOME' }),
    ]);
    autoApproveRuleRepo.findActiveByHousehold.mockResolvedValue([
      { descriptionPattern: 'salary', categoryId: 'cat-1', type: 'INCOME' },
    ]);

    const result = await importService.applyAutoApproveRules(actor, 'imp-1');

    expect(result.total).toBe(1);
    expect(markApprovedOp).toHaveBeenCalledTimes(1);
    expect(markApprovedOp).toHaveBeenCalledWith(HOUSEHOLD, 'r2');
    expect(activity.entries).toEqual([
      {
        action: 'APPROVE',
        entityType: 'IMPORTED_TRANSACTION',
        entityId: 'r2',
        summary: 'Salary ACME',
      },
    ]);
    expect(autoApproveRuleRepo.findActiveByHousehold).toHaveBeenCalledWith(HOUSEHOLD);
    expect(importedTxRepo.findPendingByImportId).toHaveBeenCalledWith(HOUSEHOLD, 'imp-1');
  });
});
