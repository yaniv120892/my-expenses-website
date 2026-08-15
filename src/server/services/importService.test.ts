import { beforeEach, describe, expect, it, vi } from 'vitest';

const { importRepo, importedTxRepo, prismaMock, agentClient } = vi.hoisted(
  () => ({
    importRepo: {
      findById: vi.fn(),
      updateStatus: vi.fn(),
      create: vi.fn(),
    },
    importedTxRepo: { findByUserIdAndImportId: vi.fn() },
    prismaMock: { importedTransaction: { updateMany: vi.fn() } },
    agentClient: { submitExtractionRequest: vi.fn() },
  }),
);

vi.mock('@/server/repositories/importRepository', () => ({
  importRepository: importRepo,
}));
vi.mock('@/server/repositories/importedTransactionRepository', () => ({
  importedTransactionRepository: importedTxRepo,
}));
vi.mock('@/server/db/client', () => ({ default: prismaMock }));
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
const updateImportWithExtractionRequestId = vi.fn();

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
  matchSingleTransaction.mockResolvedValue(null);
  service.matchSingleTransaction = matchSingleTransaction;
  service.updateImportWithExtractionRequestId =
    updateImportWithExtractionRequestId;
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

  it('submits the extraction and moves the import to PROCESSING', async () => {
    const result = await run();
    expect(result).toEqual({ id: 'imp-1' });
    expect(agentClient.submitExtractionRequest).toHaveBeenCalledWith({
      fileUrl: url,
      filename: 'f.xlsx',
      userId: 'user-1',
      options: {
        confidenceThreshold: 0.7,
        maxRetries: 3,
        includeRawData: false,
      },
    });
    expect(importRepo.updateStatus).toHaveBeenCalledWith('imp-1', 'PROCESSING');
    expect(updateImportWithExtractionRequestId).toHaveBeenCalledWith(
      'imp-1',
      'req-9',
    );
  });

  it('a rejected submit marks the import FAILED and rethrows', async () => {
    agentClient.submitExtractionRequest.mockRejectedValue(
      new Error('agent down'),
    );
    await expect(run()).rejects.toThrow('agent down');
    expect(importRepo.updateStatus).toHaveBeenCalledWith(
      'imp-1',
      'FAILED',
      'agent down',
    );
  });

  it('a failed create never reaches the agent', async () => {
    importRepo.create.mockRejectedValue(new Error('insert failed'));
    await expect(run()).rejects.toThrow('insert failed');
    expect(agentClient.submitExtractionRequest).not.toHaveBeenCalled();
  });
});
