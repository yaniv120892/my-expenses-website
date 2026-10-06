import { describe, expect, it } from 'vitest';
import { ScheduledTransaction } from '@/types';
import {
  forecastFixedExpenses,
  toMonthlyScheduledAmount,
} from '@/utils/scheduledForecast';

const oct6 = new Date(2026, 9, 6, 12);

function scheduled(
  overrides: Partial<ScheduledTransaction>,
): ScheduledTransaction {
  return {
    id: 'id',
    description: 'Rent',
    value: 100,
    type: 'EXPENSE',
    categoryId: 'c1',
    scheduleType: 'MONTHLY',
    nextRunDate: '2026-10-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('toMonthlyScheduledAmount', () => {
  it.each([
    ['MONTHLY', undefined, 100],
    ['MONTHLY', 2, 50],
    ['YEARLY', undefined, 100 / 12],
    ['WEEKLY', undefined, (100 * 52) / 12],
    ['WEEKLY', 2, (100 * 52) / 24],
    ['DAILY', undefined, (100 * 365) / 12],
    ['CUSTOM', 10, (100 * 365) / 120],
  ] as const)('%s every %s', (scheduleType, interval, expected) => {
    expect(
      toMonthlyScheduledAmount(scheduled({ scheduleType, interval })),
    ).toBeCloseTo(expected, 6);
  });
});

describe('forecastFixedExpenses', () => {
  it('sums expense charges still due before the month ends', () => {
    const forecast = forecastFixedExpenses(
      [
        scheduled({ value: 5000, dayOfMonth: 10 }),
        scheduled({
          value: 50,
          scheduleType: 'WEEKLY',
          dayOfWeek: 1,
          nextRunDate: '2026-10-11T00:00:00.000Z',
        }),
        scheduled({
          value: 1200,
          scheduleType: 'YEARLY',
          nextRunDate: '2027-03-01T00:00:00.000Z',
        }),
      ],
      oct6,
    );

    // Weekly on Sundays: Oct 11, 18, 25.
    expect(forecast.remainingThisMonth).toBe(5000 + 3 * 50);
    expect(forecast.remainingCount).toBe(4);
    expect(forecast.monthlyTotal).toBeCloseTo(5000 + 50 * (52 / 12) + 100, 2);
  });

  it('ignores scheduled income', () => {
    const forecast = forecastFixedExpenses(
      [scheduled({ type: 'INCOME', value: 20000 })],
      oct6,
    );

    expect(forecast).toEqual({
      expenseCount: 0,
      monthlyTotal: 0,
      remainingThisMonth: 0,
      remainingCount: 0,
    });
  });

  it('counts an overdue run that the cron has not processed yet', () => {
    const forecast = forecastFixedExpenses(
      [
        scheduled({
          dayOfMonth: 5,
          nextRunDate: '2026-10-05T00:00:00.000Z',
        }),
      ],
      oct6,
    );

    expect(forecast.remainingCount).toBe(1);
  });

  it('counts a long-overdue schedule from today, as the cron catches up', () => {
    const forecast = forecastFixedExpenses(
      [
        scheduled({
          value: 20,
          scheduleType: 'DAILY',
          nextRunDate: '2024-01-01T00:00:00.000Z',
        }),
      ],
      oct6,
    );

    // Oct 6 through Oct 31.
    expect(forecast.remainingCount).toBe(26);
    expect(forecast.remainingThisMonth).toBe(520);
  });

  it('keeps a run on the 1st of next month out of this month', () => {
    const forecast = forecastFixedExpenses(
      [scheduled({ dayOfMonth: 1, nextRunDate: '2026-11-01T00:00:00.000Z' })],
      oct6,
    );

    expect(forecast.remainingCount).toBe(0);
  });

  it('skips a schedule with no next run date', () => {
    const forecast = forecastFixedExpenses(
      [scheduled({ nextRunDate: undefined })],
      oct6,
    );

    expect(forecast.remainingCount).toBe(0);
    expect(forecast.monthlyTotal).toBe(100);
  });

  it('counts a schedule that cannot advance once', () => {
    const forecast = forecastFixedExpenses(
      [scheduled({ dayOfMonth: 0, nextRunDate: '2026-10-31T00:00:00.000Z' })],
      oct6,
    );

    expect(forecast.remainingCount).toBe(1);
  });
});
