import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'content-disposition';

const { getSignedUrl } = vi.hoisted(() => ({ getSignedUrl: vi.fn() }));
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl }));

import {
  buildAttachmentKey,
  buildDownloadUrl,
  isAttachmentKeyForTransaction,
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

    const header: unknown = getSignedUrl.mock.calls[0]?.[1].input.ResponseContentDisposition;
    if (typeof header !== 'string') {
      throw new Error(`expected a signed disposition header, got ${String(header)}`);
    }
    expect(parse(header)).toEqual({
      type: 'attachment',
      parameters: expect.objectContaining({ filename: fileName }),
    });
  });
});

describe('buildAttachmentKey', () => {
  it('keeps no part of the file name, only the id and the lowercased extension', () => {
    const key = buildAttachmentKey('t', 'Leumi statement March.XLSX', 'id');

    expect(key).toBe('transactions/t/id.xlsx');
    for (const part of ['Leumi', 'statement', 'March']) {
      expect(key.toLowerCase()).not.toContain(part.toLowerCase());
    }
  });

  it('builds a bare id for a name without an extension', () => {
    expect(buildAttachmentKey('t', 'receipt', 'id')).toBe('transactions/t/id');
  });
});

describe('isAttachmentKeyForTransaction', () => {
  it('accepts a key built now', () => {
    expect(isAttachmentKeyForTransaction(buildAttachmentKey('t', 'receipt.pdf', 'id'), 't')).toBe(
      true,
    );
  });

  it('still accepts a key from before, which ended with the file name', () => {
    expect(isAttachmentKeyForTransaction('transactions/t/id-receipt march.pdf', 't')).toBe(true);
  });

  it("refuses another transaction's key", () => {
    expect(
      isAttachmentKeyForTransaction(buildAttachmentKey('other', 'receipt.pdf', 'id'), 't'),
    ).toBe(false);
  });
});
