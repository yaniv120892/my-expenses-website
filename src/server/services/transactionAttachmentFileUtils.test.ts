import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'content-disposition';

const { getSignedUrl } = vi.hoisted(() => ({ getSignedUrl: vi.fn() }));
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl }));

import {
  buildAttachmentKey,
  buildDownloadUrl,
} from '@/server/services/transactionAttachmentFileUtils';

beforeEach(() => {
  vi.clearAllMocks();
  getSignedUrl.mockResolvedValue('https://signed.example');
  process.env.TRANSACTION_ATTACHMENT_S3_REGION = 'eu-central-1';
  process.env.TRANSACTION_ATTACHMENT_S3_ACCESS_KEY_ID = 'key';
  process.env.TRANSACTION_ATTACHMENT_S3_SECRET_ACCESS_KEY = 'secret';
  process.env.TRANSACTION_ATTACHMENT_S3_BUCKET_NAME = 'bucket';
});

describe('buildDownloadUrl', () => {
  it('signs a disposition header that reads back the exact file name, quotes and Hebrew included', async () => {
    const fileName = 'קבלה "נובמבר".pdf';

    await buildDownloadUrl('transactions/t/key.pdf', fileName);

    const header = getSignedUrl.mock.calls[0][1].input
      .ResponseContentDisposition as string;
    expect(parse(header)).toEqual({
      type: 'attachment',
      parameters: expect.objectContaining({ filename: fileName }),
    });
  });
});

describe('buildAttachmentKey', () => {
  it('keeps a name without an extension as it is', () => {
    expect(buildAttachmentKey('t', 'receipt', 'id')).toBe(
      'transactions/t/id-receipt',
    );
  });

  it('keeps every dot of a multi-dot name', () => {
    expect(buildAttachmentKey('t', 'march.2026.pdf', 'id')).toBe(
      'transactions/t/id-march.2026.pdf',
    );
  });
});
