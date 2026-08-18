import { SubscriptionFrequency } from '@prisma/client';
import { addWeeks, addMonths, addYears } from 'date-fns';
import { toAnnualCost, toMonthlyCost } from '@/utils/subscriptionCost';

export { roundToCents } from '@/utils/subscriptionCost';

export function toMonthlyAmount(
  amount: number,
  frequency: SubscriptionFrequency,
): number {
  return toMonthlyCost(amount, frequency);
}

export function toAnnualAmount(
  amount: number,
  frequency: SubscriptionFrequency,
): number {
  return toAnnualCost(amount, frequency);
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
