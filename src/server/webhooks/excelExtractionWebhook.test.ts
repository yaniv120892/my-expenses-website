import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ObservabilityModule from '@/server/observability';

const {
  getRateToBase,
  importRepo,
  importedTxRepo,
  prismaMock,
  findPotentialMatchesForImport,
  extractWebhookParams,
  reportError,
} = vi.hoisted(() => ({
  getRateToBase: vi.fn(),
  importRepo: {
    findByExtractionRequestId: vi.fn(),
    findById: vi.fn(),
    findExisting: vi.fn(),
    updateStatus: vi.fn(),
    transitionStatus: vi.fn(),
    markFailedIfProcessing: vi.fn(),
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
  reportError: vi.fn(),
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
vi.mock('@/server/services/exchangeRateService', () => ({
  default: { getRateToBase },
}));
vi.mock('@/server/observability', async (importOriginal) => ({
  ...(await importOriginal<typeof ObservabilityModule>()),
  observability: { reportError },
}));
vi.mock('@/server/services/importService', () => ({
  importService: {
    findPotentialMatchesForImport: (...a: unknown[]) => findPotentialMatchesForImport(...a),
  },
}));

import { processExcelExtractionWebhook } from '@/server/webhooks/excelExtractionWebhook';
import { firstInvocationOrder } from '@/test/mocks';

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

function createdRows() {
  const [firstCall] = importedTxRepo.createMany.mock.calls;
  if (!firstCall) {
    throw new Error('createMany was not called');
  }
  return firstCall[0];
}

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
  importedTxRepo.moveToImportOps.mockImplementation((ids: string[], to: string) =>
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
  prismaMock.import.update.mockImplementation((args: unknown) => ({
    op: 'updateImport',
    args,
  }));
  prismaMock.$transaction.mockResolvedValue([]);
  findPotentialMatchesForImport.mockResolvedValue(undefined);
});

describe('completed extraction with currencies', () => {
  const foreignRow = (over: Record<string, unknown>) => ({
    ...tx('Amazon'),
    value: 92.35,
    originalAmount: 25,
    originalCurrency: 'USD',
    chargedAmount: 92.35,
    chargedCurrency: 'ILS',
    ...over,
  });

  it('stores the statement conversion of a billed foreign charge', async () => {
    await run(payload([foreignRow({})]));

    const [row] = createdRows();
    expect(row).toMatchObject({
      value: 92.35,
      currency: 'USD',
      originalAmount: '25.00',
      exchangeRate: '3.69400000',
      exchangeRateSource: 'STATEMENT',
    });
    expect(getRateToBase).not.toHaveBeenCalled();
  });

  it('stores an unknown ILS amount, not the foreign one, when no rate exists', async () => {
    getRateToBase.mockResolvedValue(null);

    await run(
      payload([
        foreignRow({
          value: 10,
          originalAmount: 10,
          originalCurrency: 'EUR',
          chargedAmount: undefined,
          chargedCurrency: undefined,
        }),
      ]),
    );

    const [row] = createdRows();
    expect(row).toMatchObject({
      value: null,
      currency: 'EUR',
      originalAmount: '10.00',
    });
  });

  it('leaves the currency and ILS amount of an ambiguous row unknown', async () => {
    await run(
      payload([
        {
          ...tx('Refund'),
          value: 10,
          originalAmount: 10,
          currencyAmbiguous: true,
        },
      ]),
    );

    const [row] = createdRows();
    expect(row).toMatchObject({
      value: null,
      currency: null,
    });
  });

  it('ignores a currency code it does not recognise rather than failing the import', async () => {
    await run(payload([foreignRow({ originalCurrency: 'ZZZ' })]));

    const [row] = createdRows();
    expect(row).toMatchObject({ value: 92.35, currency: null });
  });

  it('leaves the ILS amount unknown, not the foreign one, for an unrecognised code', async () => {
    await run(
      payload([
        foreignRow({
          originalCurrency: 'ZZZ',
          chargedAmount: undefined,
          chargedCurrency: undefined,
        }),
      ]),
    );

    const [row] = createdRows();
    expect(row).toMatchObject({
      value: null,
      currency: null,
      originalAmount: '25.00',
    });
  });
});

describe('completed extraction', () => {
  it('no duplicate: inserts rows, matches, marks COMPLETED', async () => {
    const response = await run(payload([tx()]));
    expect(response.status).toBe(200);

    const rows = createdRows();
    expect(rows).toEqual([
      {
        description: 'Coffee',
        value: 12.5,
        currency: 'ILS',
        originalAmount: '12.50',
        exchangeRate: null,
        exchangeRateDate: null,
        exchangeRateSource: null,
        date: new Date(2026, 2, 7),
        type: 'EXPENSE',
        rawData: {},
        matchingTransactionId: null,
        importId: 'imp-1',
        userId: 'user-1',
      },
    ]);
    expect(findPotentialMatchesForImport).toHaveBeenCalledWith('imp-1', 'user-1');
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
    const updateOrder = firstInvocationOrder(prismaMock.import.update);
    const findOrder = firstInvocationOrder(importRepo.findExisting);
    expect(updateOrder).toBeLessThan(findOrder);
  });

  it('keeps the payment month the import was submitted with when extraction disagrees', async () => {
    importRepo.findByExtractionRequestId.mockResolvedValue({
      id: 'imp-1',
      userId: 'user-1',
      createdAt: CREATED_AT,
      paymentMonth: '02/2026',
    });

    await run(payload([tx()]));

    expect(prismaMock.import.update).toHaveBeenCalledWith({
      where: { id: 'imp-1' },
      data: expect.objectContaining({ paymentMonth: '02/2026' }),
    });
    expect(importRepo.findExisting).toHaveBeenCalledWith('user-1', '02/2026', '4242', 'imp-1');
  });

  it('a null month from extraction does not wipe the submitted one', async () => {
    importRepo.findByExtractionRequestId.mockResolvedValue({
      id: 'imp-1',
      userId: 'user-1',
      createdAt: CREATED_AT,
      paymentMonth: '02/2026',
    });

    await run({
      requestId: 'req-1',
      status: 'COMPLETED',
      result: {
        transactions: [tx()],
        metadata: { paymentMonth: null, creditCardLastFour: '4242' },
      },
    });

    expect(prismaMock.import.update).toHaveBeenCalledWith({
      where: { id: 'imp-1' },
      data: expect.objectContaining({ paymentMonth: '02/2026' }),
    });
    // Duplicate detection needs the month, so it must still run.
    expect(importRepo.findExisting).toHaveBeenCalledWith('user-1', '02/2026', '4242', 'imp-1');
  });

  it('fills the payment month from extraction when the import was submitted without one', async () => {
    importRepo.findByExtractionRequestId.mockResolvedValue({
      id: 'imp-1',
      userId: 'user-1',
      createdAt: CREATED_AT,
      paymentMonth: null,
    });

    await run(payload([tx()]));

    expect(prismaMock.import.update).toHaveBeenCalledWith({
      where: { id: 'imp-1' },
      data: expect.objectContaining({ paymentMonth: '03/2026' }),
    });
  });

  it('stores an extracted month padded, so it keys the same duplicate as 03/2026', async () => {
    const body = payload([tx()]);
    body.result.metadata.paymentMonth = '3/2026';

    await run(body);

    expect(prismaMock.import.update).toHaveBeenCalledWith({
      where: { id: 'imp-1' },
      data: expect.objectContaining({ paymentMonth: '03/2026' }),
    });
    expect(importRepo.findExisting).toHaveBeenCalledWith('user-1', '03/2026', '4242', 'imp-1');
  });

  it('stores no month, and looks for no duplicate, when the extracted one is unreadable', async () => {
    const body = payload([tx()]);
    body.result.metadata.paymentMonth = '2026-03';

    await run(body);

    expect(prismaMock.import.update).toHaveBeenCalledWith({
      where: { id: 'imp-1' },
      data: expect.objectContaining({ paymentMonth: null }),
    });
    expect(importRepo.findExisting).not.toHaveBeenCalled();
  });

  it('pads a submitted month stored before writes were normalized', async () => {
    importRepo.findByExtractionRequestId.mockResolvedValue({
      id: 'imp-1',
      userId: 'user-1',
      createdAt: CREATED_AT,
      paymentMonth: '3/2026',
    });

    await run(payload([tx()]));

    expect(importRepo.findExisting).toHaveBeenCalledWith('user-1', '03/2026', '4242', 'imp-1');
  });

  it('uses the extracted month when the submitted one names no month', async () => {
    importRepo.findByExtractionRequestId.mockResolvedValue({
      id: 'imp-1',
      userId: 'user-1',
      createdAt: CREATED_AT,
      paymentMonth: '2026-03',
    });

    await run(payload([tx()]));

    expect(prismaMock.import.update).toHaveBeenCalledWith({
      where: { id: 'imp-1' },
      data: expect.objectContaining({ paymentMonth: '03/2026' }),
    });
  });

  it('inserts its own rows before looking for a duplicate', async () => {
    await run(payload([tx()]));

    const insertOrder = firstInvocationOrder(importedTxRepo.createMany);
    const findOrder = firstInvocationOrder(importRepo.findExisting);
    expect(insertOrder).toBeLessThan(findOrder);
  });

  it('no duplicate and zero transactions: skips insert, still finalizes', async () => {
    await run(payload([]));
    expect(importedTxRepo.createMany).not.toHaveBeenCalled();
    expect(importRepo.updateStatus).toHaveBeenCalledWith('imp-1', 'COMPLETED');
  });

  it('older duplicate: moves non-duplicate rows into it and marks this import merged', async () => {
    importRepo.findExisting.mockResolvedValue({
      id: 'imp-old',
      createdAt: OLDER,
    });
    importedTxRepo.findByImportId.mockResolvedValue([
      storedRow('row-1'),
      storedRow('row-2', 'Tea'),
    ]);
    importedTxRepo.filterDuplicates.mockImplementation(async (_id, rows) => rows.slice(0, 1));

    await run(payload([tx(), tx('Tea')]));

    const [scopeId] = importedTxRepo.filterDuplicates.mock.calls[0] ?? [];
    expect(scopeId).toBe('imp-old');

    expect(importedTxRepo.moveToImportOps).toHaveBeenCalledWith(['row-1'], 'imp-old');
    // One batch, so nothing reads rows reparented under an unmerged import or a
    // survivor with unmatched rows.
    expect(prismaMock.$transaction).toHaveBeenCalledWith([
      { op: 'move', ids: ['row-1'], to: 'imp-old' },
      { op: 'deleteRows', id: 'imp-1' },
      {
        op: 'updateImport',
        args: { where: { id: 'imp-old' }, data: { status: 'REMATCHING' } },
      },
      {
        op: 'updateImport',
        args: {
          where: { id: 'imp-1' },
          data: {
            status: 'MERGED',
            mergedIntoImportId: 'imp-old',
            completedAt: expect.any(Date),
          },
        },
      },
    ]);
    expect(prismaMock.import.delete).not.toHaveBeenCalled();
    expect(findPotentialMatchesForImport).toHaveBeenCalledWith('imp-old', 'user-1');
    // The survivor is released only once the moved rows are matched.
    const matchOrder = firstInvocationOrder(findPotentialMatchesForImport);
    const releaseOrder = firstInvocationOrder(importRepo.transitionStatus);
    expect(matchOrder).toBeLessThan(releaseOrder);
    expect(importRepo.transitionStatus).toHaveBeenCalledWith('imp-old', 'REMATCHING', 'COMPLETED');
    expect(importRepo.updateStatus).not.toHaveBeenCalledWith('imp-1', 'COMPLETED');
  });

  it('merges into a newer import that completed first, so a slow older upload still dedupes', async () => {
    importRepo.findExisting.mockResolvedValue({
      id: 'imp-new',
      createdAt: NEWER,
    });
    importedTxRepo.findByImportId.mockResolvedValue([storedRow('row-1')]);
    importedTxRepo.filterDuplicates.mockImplementation(async () => []);

    await run(payload([tx()]));

    expect(importedTxRepo.filterDuplicates.mock.calls[0]?.[0]).toBe('imp-new');
    expect(prismaMock.import.update).toHaveBeenCalledWith({
      where: { id: 'imp-1' },
      data: expect.objectContaining({
        status: 'MERGED',
        mergedIntoImportId: 'imp-new',
      }),
    });
    expect(importRepo.transitionStatus).toHaveBeenCalledWith('imp-new', 'REMATCHING', 'COMPLETED');
    expect(importRepo.updateStatus).not.toHaveBeenCalledWith('imp-1', 'COMPLETED');
  });

  it('a failing match is swallowed and the import still finalizes', async () => {
    findPotentialMatchesForImport.mockRejectedValue(new Error('boom'));
    const response = await run(payload([tx()]));
    expect(response.status).toBe(200);
    expect(importRepo.updateStatus).toHaveBeenCalledWith('imp-1', 'COMPLETED');
  });

  it('a missing import record fails the webhook', async () => {
    importRepo.findById.mockResolvedValue(null);
    importRepo.findByExtractionRequestId.mockResolvedValue(null);
    const response = await run(payload([tx()]));
    expect(response.status).toBe(404);
  });

  it('rawData defaults to an empty object', async () => {
    await run(payload([{ ...tx(), rawData: { a: 1 } }, tx('Tea')]));
    const rows = createdRows();
    expect(rows[0].rawData).toEqual({ a: 1 });
    expect(rows[1].rawData).toEqual({});
  });

  it('a COMPLETED payload with no result fails the import', async () => {
    const response = await run({ requestId: 'req-1', status: 'COMPLETED' });

    expect(response.status).toBe(400);
    expect(importRepo.updateStatus).toHaveBeenCalledWith('imp-1', 'FAILED', expect.any(String));
  });

  it('one unreadable row fails the import rather than the request only', async () => {
    const response = await run(payload([{ ...tx(), date: 'the fifth of August' }]));

    expect(response.status).toBe(400);
    expect(importRepo.updateStatus).toHaveBeenCalledWith('imp-1', 'FAILED', expect.any(String));
  });

  it('accepts a non-padded date and absent card metadata', async () => {
    const response = await run({
      requestId: 'req-1',
      status: 'COMPLETED',
      result: {
        transactions: [{ ...tx(), date: '5/8/2026' }],
        metadata: { paymentMonth: null, creditCardLastFour: null },
      },
    });

    expect(response.status).toBe(200);
    const rows = createdRows();
    expect(rows[0].date).toEqual(new Date(2026, 7, 5));
    expect(importRepo.findExisting).not.toHaveBeenCalled();
  });

  it('marks the import failed when processing throws', async () => {
    importedTxRepo.createMany.mockRejectedValue(new Error('insert failed'));

    const response = await run(payload([tx()]));

    expect(response.status).toBe(500);
    expect(importRepo.markFailedIfProcessing).toHaveBeenCalledWith('imp-1', expect.any(String));
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        where: 'Error processing webhook',
        context: expect.objectContaining({ importId: 'imp-1' }),
      }),
    );
  });

  it('stores an UNKNOWN bank source as no bank source', async () => {
    const body = payload([tx()]);
    body.result.metadata.bankSourceType = 'UNKNOWN';

    const response = await run(body);

    expect(response.status).toBe(200);
    expect(prismaMock.import.update).toHaveBeenCalledWith({
      where: { id: 'imp-1' },
      data: expect.objectContaining({ bankSourceType: null }),
    });
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

    const response = await run(payload([tx()]));

    expect(response.status).toBe(200);
    expect(importRepo.findByExtractionRequestId).not.toHaveBeenCalled();
    expect(importRepo.findById).toHaveBeenCalledWith('imp-1');
  });

  it('falls back to the requestId for callbacks issued without an importId', async () => {
    const response = await run(payload([tx()]));

    expect(response.status).toBe(200);
    expect(importRepo.findByExtractionRequestId).toHaveBeenCalledWith('req-1');
  });

  it('rejects a callback for another user', async () => {
    importRepo.findByExtractionRequestId.mockResolvedValue({
      id: 'imp-1',
      userId: 'someone-else',
      createdAt: CREATED_AT,
    });

    const response = await run(payload([tx()]));

    expect(response.status).toBe(403);
    expect(importRepo.claimExtraction).not.toHaveBeenCalled();
  });
});

describe('redelivered callbacks', () => {
  it('is a no-op when another callback already claimed the extraction', async () => {
    importRepo.claimExtraction.mockResolvedValue(false);

    const response = await run(payload([tx()]));

    expect(response.status).toBe(200);
    expect(importedTxRepo.createMany).not.toHaveBeenCalled();
    expect(importRepo.updateStatus).not.toHaveBeenCalled();
    expect(prismaMock.import.delete).not.toHaveBeenCalled();
  });

  it('marks FAILED but keeps the claim when processing throws', async () => {
    importedTxRepo.createMany.mockRejectedValue(new Error('insert exploded'));

    const response = await run(payload([tx()]));

    expect(response.status).toBe(500);
    expect(importRepo.markFailedIfProcessing).toHaveBeenCalledWith(
      'imp-1',
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

  it('fails only an import still PROCESSING, so a crash after the merge keeps its MERGED pointer', async () => {
    importRepo.findExisting.mockResolvedValue({
      id: 'imp-old',
      createdAt: OLDER,
    });
    importedTxRepo.findByImportId.mockResolvedValue([storedRow('row-1')]);
    importRepo.transitionStatus.mockRejectedValueOnce(new Error('db blip'));

    const response = await run(payload([tx()]));

    expect(response.status).toBe(500);
    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(importRepo.updateStatus).not.toHaveBeenCalledWith('imp-1', 'FAILED', expect.anything());
    expect(importRepo.markFailedIfProcessing).toHaveBeenCalledWith('imp-1', expect.any(String));
  });

  it('releases the survivor from REMATCHING when the webhook fails after the merge committed', async () => {
    importRepo.findExisting.mockResolvedValue({
      id: 'imp-old',
      createdAt: OLDER,
    });
    importedTxRepo.findByImportId.mockResolvedValue([storedRow('row-1')]);
    importRepo.transitionStatus.mockRejectedValueOnce(new Error('db blip')).mockResolvedValue(true);
    importRepo.markFailedIfProcessing.mockResolvedValue(false);
    importRepo.findById.mockResolvedValue({
      id: 'imp-1',
      userId: 'user-1',
      status: 'MERGED',
      mergedIntoImportId: 'imp-old',
    });

    const response = await run(payload([tx()]));

    expect(response.status).toBe(500);
    expect(importRepo.transitionStatus).toHaveBeenLastCalledWith(
      'imp-old',
      'REMATCHING',
      'COMPLETED',
    );
    expect(importRepo.transitionStatus).toHaveBeenCalledTimes(2);
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it('leaves the survivor alone when the failing import was never merged', async () => {
    importRepo.updateStatus.mockRejectedValue(new Error('db blip'));
    importRepo.markFailedIfProcessing.mockResolvedValue(false);
    importRepo.findById.mockResolvedValue({
      id: 'imp-1',
      userId: 'user-1',
      status: 'COMPLETED',
      mergedIntoImportId: null,
    });

    const response = await run(payload([tx()]));

    expect(response.status).toBe(500);
    expect(importRepo.transitionStatus).not.toHaveBeenCalled();
  });

  it('claims before doing any work', async () => {
    await run(payload([tx()]));

    const claimOrder = firstInvocationOrder(importRepo.claimExtraction);
    const insertOrder = firstInvocationOrder(importedTxRepo.createMany);
    expect(claimOrder).toBeLessThan(insertOrder);
  });
});
