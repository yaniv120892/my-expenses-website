import { DetectedSubscription } from '@/types/subscription';

export type SubscriptionSortKey =
  'MONTHLY_DESC' | 'MONTHLY_ASC' | 'ANNUAL_DESC' | 'NEXT_CHARGE' | 'NAME';

export const SUBSCRIPTION_SORT_OPTIONS: {
  value: SubscriptionSortKey;
  label: string;
}[] = [
  { value: 'MONTHLY_DESC', label: 'Monthly cost — high to low' },
  { value: 'MONTHLY_ASC', label: 'Monthly cost — low to high' },
  { value: 'ANNUAL_DESC', label: 'Annual cost — high to low' },
  { value: 'NEXT_CHARGE', label: 'Next charge — soonest first' },
  { value: 'NAME', label: 'Name — A to Z' },
];

export function sortSubscriptions(
  subscriptions: DetectedSubscription[],
  sortKey: SubscriptionSortKey,
): DetectedSubscription[] {
  const sorted = [...subscriptions];
  switch (sortKey) {
    case 'MONTHLY_DESC':
      return sorted.sort((a, b) => b.monthlyCost - a.monthlyCost);
    case 'MONTHLY_ASC':
      return sorted.sort((a, b) => a.monthlyCost - b.monthlyCost);
    case 'ANNUAL_DESC':
      return sorted.sort((a, b) => b.annualCost - a.annualCost);
    case 'NEXT_CHARGE':
      return sorted.sort(
        (a, b) =>
          new Date(a.nextExpectedDate).getTime() -
          new Date(b.nextExpectedDate).getTime(),
      );
    case 'NAME':
      return sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
}
