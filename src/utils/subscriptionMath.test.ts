import { describe, expect, it } from 'vitest';
import {
  nextExpectedDateAfter,
  toAnnualAmount,
  toMonthlyAmount,
} from '@/utils/subscriptionMath';

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

describe('toAnnualAmount', () => {
  it('scales each frequency onto a year', () => {
    expect(toAnnualAmount(10, 'WEEKLY')).toBe(520);
    expect(toAnnualAmount(10, 'MONTHLY')).toBe(120);
    expect(toAnnualAmount(10, 'YEARLY')).toBe(10);
  });

  it('round-trips against toMonthlyAmount', () => {
    for (const frequency of ['WEEKLY', 'MONTHLY', 'YEARLY'] as const) {
      expect(toAnnualAmount(30, frequency) / 12).toBeCloseTo(
        toMonthlyAmount(30, frequency),
        10,
      );
    }
  });
});

describe('nextExpectedDateAfter', () => {
  const last = new Date('2026-01-31T00:00:00Z');

  it('advances by one period of the frequency', () => {
    expect(nextExpectedDateAfter(last, 'WEEKLY')).toEqual(
      new Date('2026-02-07T00:00:00Z'),
    );
    expect(nextExpectedDateAfter(last, 'YEARLY')).toEqual(
      new Date('2027-01-31T00:00:00Z'),
    );
  });

  it('clamps a month-end date to the shorter month', () => {
    expect(nextExpectedDateAfter(last, 'MONTHLY')).toEqual(
      new Date('2026-02-28T00:00:00Z'),
    );
  });
});
