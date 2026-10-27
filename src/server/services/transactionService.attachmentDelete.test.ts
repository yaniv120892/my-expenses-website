import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ObservabilityModule from '@/server/observability';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

const {
  deleteTransaction,
  getTransactionItem,
  findById,
  markForDeletion,
  markDeleted,
  hasActiveFileWithKey,
  reportError,
} = vi.hoisted(() => ({
  deleteTransaction: vi.fn(),
  getTransactionItem: vi.fn(),
  findById: vi.fn(),
  markForDeletion: vi.fn(),
  markDeleted: vi.fn(),
  hasActiveFileWithKey: vi.fn(),
  reportError: vi.fn(),
}));

vi.mock('@/server/repositories/transactionRepository', () => ({
  default: { deleteTransaction, getTransactionItem },
}));

vi.mock('@/server/repositories/transactionFileRepository', () => ({
  default: { findById, markForDeletion, markDeleted, hasActiveFileWithKey },
}));

vi.mock('@/server/observability', async (importOriginal) => ({
  ...(await importOriginal<typeof ObservabilityModule>()),
  observability: { reportError },
}));

import transactionService from '@/server/services/transactionService';
import { firstInvocationOrder } from '@/test/mocks';

const TRANSACTION_ID = '11111111-1111-4111-8111-111111111111';
const FILE_ID = '22222222-2222-4222-8222-222222222222';
const FILE_KEY = `transactions/${TRANSACTION_ID}/abc-receipt.pdf`;
const OTHER_KEY = `transactions/${TRANSACTION_ID}/def-invoice.pdf`;

const send = vi.spyOn(S3Client.prototype, 'send');

function deletedKeys(): unknown[] {
  return send.mock.calls.map(([command]) => {
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    return command.input;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TRANSACTION_ATTACHMENT_S3_REGION = 'eu-central-1';
  process.env.TRANSACTION_ATTACHMENT_S3_ACCESS_KEY_ID = 'key';
  process.env.TRANSACTION_ATTACHMENT_S3_SECRET_ACCESS_KEY = 'secret';
  process.env.TRANSACTION_ATTACHMENT_S3_BUCKET_NAME = 'bucket';
  send.mockImplementation(async () => ({}));
  getTransactionItem.mockResolvedValue({ id: TRANSACTION_ID });
  findById.mockResolvedValue({
    id: FILE_ID,
    transactionId: TRANSACTION_ID,
    fileKey: FILE_KEY,
  });
  markForDeletion.mockResolvedValue({});
  markDeleted.mockResolvedValue({});
  hasActiveFileWithKey.mockResolvedValue(false);
  deleteTransaction.mockResolvedValue([FILE_KEY, OTHER_KEY]);
});

afterEach(() => {
  send.mockReset();
});

describe('removeFile', () => {
  it('deletes the attachment object after marking the row, then marks it deleted', async () => {
    await transactionService.removeFile(TRANSACTION_ID, FILE_ID, 'user-1');

    expect(deletedKeys()).toEqual([{ Bucket: 'bucket', Key: FILE_KEY }]);
    expect(firstInvocationOrder(markForDeletion)).toBeLessThan(firstInvocationOrder(send));
    expect(markDeleted).toHaveBeenCalledWith(FILE_ID);
  });

  it('bounds the storage call with an abort signal', async () => {
    await transactionService.removeFile(TRANSACTION_ID, FILE_ID, 'user-1');

    const [, options] = send.mock.calls[0] ?? [];
    expect(options).toEqual({ abortSignal: expect.any(AbortSignal) });
  });

  it('still succeeds when storage refuses the delete, reports it, and leaves the row marked', async () => {
    const storageError = new Error('AccessDenied');
    send.mockRejectedValue(storageError);

    await expect(
      transactionService.removeFile(TRANSACTION_ID, FILE_ID, 'user-1'),
    ).resolves.toBeUndefined();

    expect(markForDeletion).toHaveBeenCalledWith(FILE_ID);
    expect(markDeleted).not.toHaveBeenCalled();
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: storageError,
        where: expect.any(String),
        context: expect.objectContaining({
          fileKey: FILE_KEY,
          transactionId: TRANSACTION_ID,
          fileId: FILE_ID,
        }),
      }),
    );
  });

  it('reports a failed DELETED marking as such, not as a storage failure', async () => {
    const markError = new Error('db blip');
    markDeleted.mockRejectedValue(markError);

    await expect(
      transactionService.removeFile(TRANSACTION_ID, FILE_ID, 'user-1'),
    ).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: markError,
        where: 'Deleted attachment object but failed to mark its file DELETED',
        context: expect.objectContaining({ fileId: FILE_ID }),
      }),
    );
  });

  it('keeps an object another active attachment still names', async () => {
    hasActiveFileWithKey.mockResolvedValue(true);

    await transactionService.removeFile(TRANSACTION_ID, FILE_ID, 'user-1');

    expect(hasActiveFileWithKey).toHaveBeenCalledWith(FILE_KEY);
    expect(send).not.toHaveBeenCalled();
  });

  it('touches no object when the file is not on this transaction', async () => {
    findById.mockResolvedValue({
      id: FILE_ID,
      transactionId: 'another-transaction',
      fileKey: FILE_KEY,
    });

    await expect(
      transactionService.removeFile(TRANSACTION_ID, FILE_ID, 'user-1'),
    ).rejects.toMatchObject({ status: 404 });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('deleteTransaction', () => {
  it('deletes every attachment object the transaction delete dropped', async () => {
    await transactionService.deleteTransaction(TRANSACTION_ID, 'user-1');

    expect(deleteTransaction).toHaveBeenCalledWith(TRANSACTION_ID, 'user-1');
    expect(deletedKeys()).toEqual([
      { Bucket: 'bucket', Key: FILE_KEY },
      { Bucket: 'bucket', Key: OTHER_KEY },
    ]);
    expect(firstInvocationOrder(deleteTransaction)).toBeLessThan(firstInvocationOrder(send));
  });

  it('deletes the remaining objects when one fails, and still succeeds', async () => {
    const storageError = new Error('SlowDown');
    send.mockImplementation(async (command) => {
      const isFailingKey = command instanceof DeleteObjectCommand && command.input.Key === FILE_KEY;
      if (isFailingKey) {
        throw storageError;
      }
      return {};
    });

    await expect(
      transactionService.deleteTransaction(TRANSACTION_ID, 'user-1'),
    ).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(2);
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: storageError,
        where: expect.any(String),
        context: expect.objectContaining({ fileKey: FILE_KEY, transactionId: TRANSACTION_ID }),
      }),
    );
  });

  it('keeps every object when the row delete fails', async () => {
    deleteTransaction.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }));

    await expect(
      transactionService.deleteTransaction(TRANSACTION_ID, 'other-user'),
    ).rejects.toMatchObject({ status: 404 });
    expect(send).not.toHaveBeenCalled();
  });
});
