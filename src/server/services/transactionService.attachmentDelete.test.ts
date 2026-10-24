import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';

const {
  deleteTransaction,
  getTransactionItem,
  findById,
  findKeysByTransactionId,
  markForDeletion,
  reportSwallowedError,
} = vi.hoisted(() => ({
  deleteTransaction: vi.fn(),
  getTransactionItem: vi.fn(),
  findById: vi.fn(),
  findKeysByTransactionId: vi.fn(),
  markForDeletion: vi.fn(),
  reportSwallowedError: vi.fn(),
}));

vi.mock('@/server/repositories/transactionRepository', () => ({
  default: { deleteTransaction, getTransactionItem },
}));

vi.mock('@/server/repositories/transactionFileRepository', () => ({
  default: { findById, findKeysByTransactionId, markForDeletion },
}));

vi.mock('@/server/logging/reportSwallowedError', () => ({
  reportSwallowedError,
}));

import transactionService from '@/server/services/transactionService';

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
  findKeysByTransactionId.mockResolvedValue([FILE_KEY, OTHER_KEY]);
  deleteTransaction.mockResolvedValue(undefined);
});

afterEach(() => {
  send.mockReset();
});

describe('removeFile', () => {
  it('deletes the attachment object after marking the row', async () => {
    await transactionService.removeFile(TRANSACTION_ID, FILE_ID, 'user-1');

    expect(markForDeletion).toHaveBeenCalledWith(FILE_ID);
    expect(deletedKeys()).toEqual([{ Bucket: 'bucket', Key: FILE_KEY }]);
    expect(markForDeletion.mock.invocationCallOrder[0]).toBeLessThan(
      send.mock.invocationCallOrder[0],
    );
  });

  it('still succeeds when storage refuses the delete, and reports it', async () => {
    const storageError = new Error('AccessDenied');
    send.mockRejectedValue(storageError);

    await expect(
      transactionService.removeFile(TRANSACTION_ID, FILE_ID, 'user-1'),
    ).resolves.toBeUndefined();

    expect(markForDeletion).toHaveBeenCalledWith(FILE_ID);
    expect(reportSwallowedError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: storageError,
        fileKey: FILE_KEY,
        transactionId: TRANSACTION_ID,
        fileId: FILE_ID,
      }),
      expect.any(String),
    );
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
  it('deletes every attachment object of the transaction after the row', async () => {
    await transactionService.deleteTransaction(TRANSACTION_ID, 'user-1');

    expect(deleteTransaction).toHaveBeenCalledWith(TRANSACTION_ID, 'user-1');
    expect(deletedKeys()).toEqual([
      { Bucket: 'bucket', Key: FILE_KEY },
      { Bucket: 'bucket', Key: OTHER_KEY },
    ]);
    expect(deleteTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      send.mock.invocationCallOrder[0],
    );
  });

  it('deletes the remaining objects when one fails, and still succeeds', async () => {
    const storageError = new Error('SlowDown');
    send.mockImplementation(async (command) => {
      const isFailingKey =
        command instanceof DeleteObjectCommand &&
        command.input.Key === FILE_KEY;
      if (isFailingKey) {
        throw storageError;
      }
      return {};
    });

    await expect(
      transactionService.deleteTransaction(TRANSACTION_ID, 'user-1'),
    ).resolves.toBeUndefined();

    expect(send).toHaveBeenCalledTimes(2);
    expect(reportSwallowedError).toHaveBeenCalledTimes(1);
    expect(reportSwallowedError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: storageError,
        fileKey: FILE_KEY,
        transactionId: TRANSACTION_ID,
      }),
      expect.any(String),
    );
  });

  it('keeps every object when the row delete fails', async () => {
    deleteTransaction.mockRejectedValue(
      Object.assign(new Error('Not found'), { status: 404 }),
    );

    await expect(
      transactionService.deleteTransaction(TRANSACTION_ID, 'other-user'),
    ).rejects.toMatchObject({ status: 404 });
    expect(send).not.toHaveBeenCalled();
  });
});
