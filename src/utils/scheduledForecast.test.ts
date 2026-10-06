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
    nextRunDate: new Date(2026, 9, 10).toISOString(),
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
          nextRunDate: new Date(2026, 9, 11).toISOString(),
        }),
        scheduled({
          value: 1200,
          scheduleType: 'YEARLY',
          nextRunDate: new Date(2027, 2, 1).toISOString(),
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
          nextRunDate: new Date(2026, 9, 5).toISOString(),
        }),
      ],
      oct6,
    );

    expect(forecast.remainingCount).toBe(1);
  });
});
