import { describe, expect, it } from 'vitest';
import { attachFileSchema, getPresignedUploadUrlSchema } from '@/shared/schemas/transactions';

const attachment = (fileSize: number) => ({
  fileName: 'receipt.pdf',
  fileKey: 'transactions/tx-1/receipt.pdf',
  fileSize,
  mimeType: 'application/pdf',
});

describe('attachment size fields', () => {
  it.each([-1, 1.5])('refuses a size of %s bytes', (fileSize) => {
    expect(attachFileSchema.safeParse(attachment(fileSize)).success).toBe(false);
    expect(getPresignedUploadUrlSchema.safeParse(attachment(fileSize)).success).toBe(false);
  });

  it('accepts an empty file and a whole number of bytes', () => {
    expect(attachFileSchema.safeParse(attachment(0)).success).toBe(true);
    expect(attachFileSchema.safeParse(attachment(2048)).success).toBe(true);
  });
});
