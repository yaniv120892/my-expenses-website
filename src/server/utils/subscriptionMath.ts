import { SubscriptionFrequency } from '@prisma/client';

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
