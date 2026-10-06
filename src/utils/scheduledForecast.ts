import { endOfMonth, isAfter, max, startOfDay } from 'date-fns';
import { calculateNextRunDate } from '@/shared/scheduleDates';
import { ScheduledTransaction } from '@/types';
import { roundToCents, toMonthlyAmount } from './subscriptionMath';

const DAYS_PER_MONTH = 365 / 12;

export type FixedExpensesForecast = {
  expenseCount: number;
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
    case 'MONTHLY':
    case 'YEARLY':
      return toMonthlyAmount(tx.value, tx.scheduleType) / interval;
  }
}

export function forecastFixedExpenses(
  scheduledTransactions: ScheduledTransaction[],
  today: Date,
): FixedExpensesForecast {
  const expenses = scheduledTransactions.filter((tx) => tx.type === 'EXPENSE');
  const monthEnd = endOfMonth(today);
  let monthlyTotal = 0;
  let remainingThisMonth = 0;
  let remainingCount = 0;
  for (const tx of expenses) {
    monthlyTotal += toMonthlyScheduledAmount(tx);
    if (!tx.nextRunDate) {
      continue;
    }
    const occurrences = countOccurrencesUntil(
      tx,
      tx.nextRunDate,
      today,
      monthEnd,
    );
    remainingThisMonth += occurrences * tx.value;
    remainingCount += occurrences;
  }
  return {
    expenseCount: expenses.length,
    monthlyTotal: roundToCents(monthlyTotal),
    remainingThisMonth: roundToCents(remainingThisMonth),
    remainingCount,
  };
}

// The cron runs an overdue schedule once, on the day it catches up, so the
// walk starts no earlier than today.
function countOccurrencesUntil(
  tx: ScheduledTransaction,
  nextRunDate: string,
  today: Date,
  until: Date,
): number {
  let runDate = max([toLocalDay(nextRunDate), startOfDay(today)]);
  let count = 0;
  while (runDate <= until) {
    count += 1;
    const followingRunDate = calculateNextRunDate(
      tx.scheduleType,
      tx.interval,
      runDate,
      tx.dayOfWeek,
      tx.dayOfMonth,
    );
    if (!isAfter(followingRunDate, runDate)) {
      break;
    }
    runDate = followingRunDate;
  }
  return count;
}

// The server stores a run date as midnight UTC; reading its calendar day keeps
// a viewer west of UTC from seeing the 1st as the previous month's last day.
function toLocalDay(isoDate: string): Date {
  const date = new Date(isoDate);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
