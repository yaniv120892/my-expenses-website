import { beforeEach, describe, expect, it } from 'vitest';
import { getPresignedUploadUrl } from '@/server/services/transactionAttachmentFileUtils';

beforeEach(() => {
  process.env.TRANSACTION_ATTACHMENT_S3_REGION = 'eu-central-1';
  process.env.TRANSACTION_ATTACHMENT_S3_ACCESS_KEY_ID = 'key';
  process.env.TRANSACTION_ATTACHMENT_S3_SECRET_ACCESS_KEY = 'secret';
  process.env.TRANSACTION_ATTACHMENT_S3_BUCKET_NAME = 'bucket';
});

describe('getPresignedUploadUrl', () => {
  it('signs the declared size, so the store refuses a body of any other length', async () => {
    const { uploadUrl } = await getPresignedUploadUrl({
      transactionId: 't',
      fileName: 'receipt.pdf',
      mimeType: 'application/pdf',
      fileSize: 1234,
    });

    const signedHeaders = new URL(uploadUrl).searchParams.get(
      'X-Amz-SignedHeaders',
    );
    expect(signedHeaders?.split(';')).toContain('content-length');
  });
});
