import { addWeeks, addMonths, addYears } from 'date-fns';
import type { SubscriptionFrequency } from '@/types/subscription';
import { assertNever } from '@/utils/assertNever';

export function toMonthlyAmount(amount: number, frequency: SubscriptionFrequency): number {
  switch (frequency) {
    case 'WEEKLY':
      return (amount * 52) / 12;
    case 'MONTHLY':
      return amount;
    case 'YEARLY':
      return amount / 12;
    default:
      return assertNever({ value: frequency, what: 'subscription frequency' });
  }
}

export function toAnnualAmount(amount: number, frequency: SubscriptionFrequency): number {
  switch (frequency) {
    case 'WEEKLY':
      return amount * 52;
    case 'MONTHLY':
      return amount * 12;
    case 'YEARLY':
      return amount;
    default:
      return assertNever({ value: frequency, what: 'subscription frequency' });
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
    default:
      return assertNever({ value: frequency, what: 'subscription frequency' });
  }
}

export function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}
