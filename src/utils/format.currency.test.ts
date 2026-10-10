import { describe, expect, it } from 'vitest';
import { formatAmountWithOriginal, formatMoney } from './format';

describe('formatMoney', () => {
  it('formats a foreign amount in its own currency', () => {
    expect(formatMoney(25, 'USD')).toBe('$25.00');
    expect(formatMoney(-10.5, 'EUR')).toBe('-€10.50');
  });
});

describe('formatAmountWithOriginal', () => {
  it('shows an ILS amount alone', () => {
    expect(
      formatAmountWithOriginal({
        value: 92.35,
        currency: 'ILS',
        originalAmount: 92.35,
      }),
    ).toBe('92.35 ₪');
  });

  it('shows the original beside the ILS amount for a foreign charge', () => {
    expect(
      formatAmountWithOriginal({
        value: 92.35,
        currency: 'USD',
        originalAmount: 25,
      }),
    ).toBe('$25.00 · 92.35 ₪');
  });

  it('says the ILS amount is missing instead of showing a number', () => {
    expect(
      formatAmountWithOriginal({
        value: null,
        currency: 'USD',
        originalAmount: 25,
      }),
    ).toBe('$25.00 · ILS amount missing');
    expect(
      formatAmountWithOriginal({
        value: null,
        currency: null,
        originalAmount: 25,
      }),
    ).toBe('25 (currency unknown) · ILS amount missing');
  });
});
