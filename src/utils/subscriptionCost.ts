export type SubscriptionFrequencyValue = 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export function toMonthlyCost(
  amount: number,
  frequency: SubscriptionFrequencyValue,
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

export function toAnnualCost(
  amount: number,
  frequency: SubscriptionFrequencyValue,
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

export function roundToCents(value: number): number {
  return Math.round(value * 100) / 100;
}
