import { describe, expect, it } from 'vitest';
import {
  MAX_UPLOAD_BYTES,
  exceedsUploadLimit,
  uploadTooLargeMessage,
} from '@/shared/uploadLimits';

describe('exceedsUploadLimit', () => {
  it('holds the limit at 4 MB, under the ~4.5 MB a function accepts', () => {
    expect(MAX_UPLOAD_BYTES).toBe(4 * 1024 * 1024);
  });

  it('allows a file of exactly 4 MB', () => {
    expect(exceedsUploadLimit(4 * 1024 * 1024)).toBe(false);
  });

  it('refuses one byte more', () => {
    expect(exceedsUploadLimit(4 * 1024 * 1024 + 1)).toBe(true);
  });
});

describe('uploadTooLargeMessage', () => {
  it('names the file, its size and the limit', () => {
    expect(
      uploadTooLargeMessage({
        fileName: 'statement.xlsx',
        sizeInBytes: 4.2 * 1024 * 1024,
      }),
    ).toBe('statement.xlsx is 4.2 MB, over the 4 MB upload limit.');
  });

  it('never reports a file just over the limit as 4.0 MB', () => {
    expect(
      uploadTooLargeMessage({
        fileName: 'a.pdf',
        sizeInBytes: 4 * 1024 * 1024 + 1,
      }),
    ).toBe('a.pdf is 4.1 MB, over the 4 MB upload limit.');
  });
});
