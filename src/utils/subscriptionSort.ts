import { DetectedSubscription } from '@/types/subscription';

type Comparator = (a: DetectedSubscription, b: DetectedSubscription) => number;

const COMPARATORS = {
  MONTHLY_DESC: (a, b) => b.monthlyCost - a.monthlyCost,
  MONTHLY_ASC: (a, b) => a.monthlyCost - b.monthlyCost,
  ANNUAL_DESC: (a, b) => b.annualCost - a.annualCost,
  NEXT_CHARGE: (a, b) =>
    new Date(a.nextExpectedDate).getTime() -
    new Date(b.nextExpectedDate).getTime(),
  NAME: (a, b) => a.displayName.localeCompare(b.displayName),
} satisfies Record<string, Comparator>;

export type SubscriptionSortKey = keyof typeof COMPARATORS;

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
  return [...subscriptions].sort(COMPARATORS[sortKey]);
}
