import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { S3Client } from '@aws-sdk/client-s3';

const {
  deleteTransaction,
  getTransactionItem,
  findById,
  markForDeletion,
  markDeleted,
  hasActiveFileWithKey,
  captureException,
} = vi.hoisted(() => ({
  deleteTransaction: vi.fn(),
  getTransactionItem: vi.fn(),
  findById: vi.fn(),
  markForDeletion: vi.fn(),
  markDeleted: vi.fn(),
  hasActiveFileWithKey: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({ captureException, captureRequestError: vi.fn() }));

vi.mock('@/server/repositories/transactionRepository', () => ({
  default: { deleteTransaction, getTransactionItem },
}));

vi.mock('@/server/repositories/transactionFileRepository', () => ({
  default: { findById, markForDeletion, markDeleted, hasActiveFileWithKey },
}));

import transactionService from '@/server/services/transactionService';

const TRANSACTION_ID = '11111111-1111-4111-8111-111111111111';
const FILE_ID = '22222222-2222-4222-8222-222222222222';
const FILE_NAME = 'bank-statement-march.pdf';
const FILE_KEY = `transactions/${TRANSACTION_ID}/abc-${FILE_NAME}`;

const send = vi.spyOn(S3Client.prototype, 'send');
let stdoutWrite: MockInstance<typeof process.stdout.write>;

function loggedRecords(): Record<string, unknown>[] {
  return stdoutWrite.mock.calls.flatMap(([chunk]) =>
    String(chunk)
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line): Record<string, unknown> => JSON.parse(line)),
  );
}

function sentryPayload(): string {
  return JSON.stringify(captureException.mock.calls.map(([, captureContext]) => captureContext));
}

beforeEach(() => {
  vi.clearAllMocks();
  stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  process.env.TRANSACTION_ATTACHMENT_S3_REGION = 'eu-central-1';
  process.env.TRANSACTION_ATTACHMENT_S3_ACCESS_KEY_ID = 'key';
  process.env.TRANSACTION_ATTACHMENT_S3_SECRET_ACCESS_KEY = 'secret';
  process.env.TRANSACTION_ATTACHMENT_S3_BUCKET_NAME = 'bucket';
  send.mockRejectedValue(new Error('AccessDenied'));
  getTransactionItem.mockResolvedValue({ id: TRANSACTION_ID });
  findById.mockResolvedValue({ id: FILE_ID, transactionId: TRANSACTION_ID, fileKey: FILE_KEY });
  markForDeletion.mockResolvedValue({});
  markDeleted.mockResolvedValue({});
  hasActiveFileWithKey.mockResolvedValue(false);
  deleteTransaction.mockResolvedValue([FILE_KEY]);
});

afterEach(() => {
  stdoutWrite.mockRestore();
  send.mockReset();
});

describe('a failed attachment-object delete', () => {
  it('keeps the file name out of Sentry and the key in the log when removing a file', async () => {
    await transactionService.removeFile(TRANSACTION_ID, FILE_ID, 'user-1');

    expect(captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: expect.objectContaining({ transactionId: TRANSACTION_ID, fileId: FILE_ID }),
      extra: { transactionId: TRANSACTION_ID, fileId: FILE_ID },
    });
    expect(sentryPayload()).not.toContain(FILE_NAME);
    expect(loggedRecords()).toContainEqual(
      expect.objectContaining({ fileKey: FILE_KEY, transactionId: TRANSACTION_ID }),
    );
  });

  it('keeps the file name out of Sentry and the key in the log when deleting a transaction', async () => {
    await transactionService.deleteTransaction(TRANSACTION_ID, 'user-1');

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(sentryPayload()).not.toContain(FILE_NAME);
    expect(loggedRecords()).toContainEqual(
      expect.objectContaining({ fileKey: FILE_KEY, transactionId: TRANSACTION_ID }),
    );
  });

  it('keeps the file name out of Sentry when the object went but marking it DELETED failed', async () => {
    send.mockImplementation(async () => ({}));
    markDeleted.mockRejectedValue(new Error('db blip'));

    await transactionService.removeFile(TRANSACTION_ID, FILE_ID, 'user-1');

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(sentryPayload()).not.toContain(FILE_NAME);
  });
});
