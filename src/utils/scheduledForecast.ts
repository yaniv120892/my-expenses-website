import { endOfMonth, isAfter } from 'date-fns';
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
    const occurrences = countOccurrencesUntil(tx, monthEnd);
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

function countOccurrencesUntil(tx: ScheduledTransaction, until: Date): number {
  let runDate = new Date(tx.nextRunDate);
  let count = 0;
  while (runDate <= until) {
    count += 1;
    const nextRunDate = calculateNextRunDate(
      tx.scheduleType,
      tx.interval,
      runDate,
      tx.dayOfWeek,
      tx.dayOfMonth,
    );
    if (!isAfter(nextRunDate, runDate)) {
      break;
    }
    runDate = nextRunDate;
  }
  return count;
}
