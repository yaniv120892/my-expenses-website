import { endOfMonth } from 'date-fns';
import { calculateNextRunDate } from '@/shared/scheduleDates';
import { ScheduledTransaction } from '@/types';
import { roundToCents } from './subscriptionMath';

const DAYS_PER_MONTH = 365 / 12;
const MAX_OCCURRENCES_PER_SCHEDULE = 400;

export type FixedExpensesForecast = {
  monthlyTotal: number;
  remainingThisMonth: number;
  remainingCount: number;
};

export function toMonthlyScheduledAmount(tx: ScheduledTransaction): number {
  const interval = tx.interval || 1;
  switch (tx.scheduleType) {
    case 'DAILY':
    case 'CUSTOM':
      return (tx.value * DAYS_PER_MONTH) / interval;
    case 'WEEKLY':
      return (tx.value * 52) / 12 / interval;
    case 'MONTHLY':
      return tx.value / interval;
    case 'YEARLY':
      return tx.value / 12 / interval;
  }
}

function countOccurrencesUntil(tx: ScheduledTransaction, until: Date): number {
  let runDate = new Date(tx.nextRunDate);
  let count = 0;
  while (runDate <= until && count < MAX_OCCURRENCES_PER_SCHEDULE) {
    count += 1;
    runDate = calculateNextRunDate(
      tx.scheduleType,
      tx.interval,
      runDate,
      tx.dayOfWeek,
      tx.dayOfMonth,
    );
  }
  return count;
}

export function forecastFixedExpenses(
  scheduledTransactions: ScheduledTransaction[],
  today: Date,
): FixedExpensesForecast {
  const monthEnd = endOfMonth(today);
  let monthlyTotal = 0;
  let remainingThisMonth = 0;
  let remainingCount = 0;
  for (const tx of scheduledTransactions) {
    if (tx.type !== 'EXPENSE') {
      continue;
    }
    monthlyTotal += toMonthlyScheduledAmount(tx);
    if (!tx.nextRunDate) {
      continue;
    }
    const occurrences = countOccurrencesUntil(tx, monthEnd);
    remainingThisMonth += occurrences * tx.value;
    remainingCount += occurrences;
  }
  return {
    monthlyTotal: roundToCents(monthlyTotal),
    remainingThisMonth: roundToCents(remainingThisMonth),
    remainingCount,
  };
}
