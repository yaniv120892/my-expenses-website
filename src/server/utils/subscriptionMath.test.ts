import { describe, expect, it } from 'vitest';
import { toMonthlyAmount } from '@/server/utils/subscriptionMath';

describe('toMonthlyAmount', () => {
  it('returns the amount unchanged for MONTHLY', () => {
    expect(toMonthlyAmount(49.9, 'MONTHLY')).toBe(49.9);
    expect(toMonthlyAmount(0, 'MONTHLY')).toBe(0);
  });

  it('converts WEEKLY using 52 weeks per year over 12 months', () => {
    expect(toMonthlyAmount(12, 'WEEKLY')).toBe(52);
    expect(toMonthlyAmount(10, 'WEEKLY')).toBeCloseTo(43.3333, 3);
    expect(toMonthlyAmount(0, 'WEEKLY')).toBe(0);
  });

  it('converts YEARLY by dividing by 12', () => {
    expect(toMonthlyAmount(120, 'YEARLY')).toBe(10);
    expect(toMonthlyAmount(99, 'YEARLY')).toBeCloseTo(8.25, 10);
  });

  it('keeps relative ordering across frequencies for the same amount', () => {
    const amount = 30;
    expect(toMonthlyAmount(amount, 'WEEKLY')).toBeGreaterThan(
      toMonthlyAmount(amount, 'MONTHLY'),
    );
    expect(toMonthlyAmount(amount, 'MONTHLY')).toBeGreaterThan(
      toMonthlyAmount(amount, 'YEARLY'),
    );
  });

  it('handles fractional amounts without rounding', () => {
    expect(toMonthlyAmount(15.5, 'YEARLY')).toBeCloseTo(15.5 / 12, 10);
    expect(toMonthlyAmount(2.5, 'WEEKLY')).toBeCloseTo((2.5 * 52) / 12, 10);
  });
});
