import { describe, expect, it } from 'vitest';
import { filenameFromContentDisposition } from '@/utils/download';

describe('filenameFromContentDisposition', () => {
  it('reads a quoted filename', () => {
    expect(
      filenameFromContentDisposition(
        'attachment; filename="transactions_2026-08-01_2026-08-31.csv"',
        'fallback.csv',
      ),
    ).toBe('transactions_2026-08-01_2026-08-31.csv');
  });

  it('reads an unquoted filename', () => {
    expect(
      filenameFromContentDisposition(
        'attachment; filename=transactions.csv',
        'fallback.csv',
      ),
    ).toBe('transactions.csv');
  });

  it('falls back when the header is missing', () => {
    expect(filenameFromContentDisposition(undefined, 'fallback.csv')).toBe(
      'fallback.csv',
    );
  });

  it('falls back when the header carries no plain filename', () => {
    expect(
      filenameFromContentDisposition(
        "attachment; filename*=UTF-8''%D7%A2.csv",
        'fallback.csv',
      ),
    ).toBe('fallback.csv');
  });
});
