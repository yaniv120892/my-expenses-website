import { addWeeks, addMonths, addYears } from 'date-fns';
import { SubscriptionFrequency } from '@/types/subscription';

export function toMonthlyAmount(
  amount: number,
  frequency: SubscriptionFrequency,
): number {
  switch (frequency) {
    case 'WEEKLY':
      return (amount * 52) / 12;
    case 'MONTHLY':
      return amount;
    case 'YEARLY':
      return amount / 12;
  }
}

export function toAnnualAmount(
  amount: number,
  frequency: SubscriptionFrequency,
): number {
  switch (frequency) {
    case 'WEEKLY':
      return amount * 52;
    case 'MONTHLY':
      return amount * 12;
    case 'YEARLY':
      return amount;
  }
}

export function nextExpectedDateAfter(
  lastChargeDate: Date,
  frequency: SubscriptionFrequency,
): Date {
  switch (frequency) {
    case 'WEEKLY':
      return addWeeks(lastChargeDate, 1);
    case 'MONTHLY':
      return addMonths(lastChargeDate, 1);
    case 'YEARLY':
      return addYears(lastChargeDate, 1);
  }
}

export function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}
