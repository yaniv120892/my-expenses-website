import { describe, expect, it } from 'vitest';
import { normalizePaymentMonth } from '@/shared/paymentMonth';

describe('normalizePaymentMonth', () => {
  it('pads a single-digit month and trims spaces', () => {
    expect(normalizePaymentMonth('3/2026')).toBe('03/2026');
    expect(normalizePaymentMonth(' 03/2026 ')).toBe('03/2026');
    expect(normalizePaymentMonth('12/2025')).toBe('12/2025');
  });

  it('rejects what does not name a month', () => {
    for (const raw of [
      '',
      '13/2026',
      '0/2026',
      '03/26',
      'March 2026',
      '2026-03',
    ]) {
      expect(normalizePaymentMonth(raw)).toBeNull();
    }
  });
});
