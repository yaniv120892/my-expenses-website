import { DetectedSubscription } from '@/types/subscription';

type Comparator = (a: DetectedSubscription, b: DetectedSubscription) => number;

const COMPARATORS = {
  MONTHLY_DESC: (a, b) => b.monthlyCost - a.monthlyCost,
  MONTHLY_ASC: (a, b) => a.monthlyCost - b.monthlyCost,
  ANNUAL_DESC: (a, b) => b.annualCost - a.annualCost,
  NEXT_CHARGE: (a, b) =>
    new Date(a.nextExpectedDate).getTime() - new Date(b.nextExpectedDate).getTime(),
  NAME: (a, b) => a.displayName.localeCompare(b.displayName),
} satisfies Record<string, Comparator>;

export type SubscriptionSortKey = keyof typeof COMPARATORS;

export const SUBSCRIPTION_SORT_KEYS: readonly SubscriptionSortKey[] = [
  'MONTHLY_DESC',
  'MONTHLY_ASC',
  'ANNUAL_DESC',
  'NEXT_CHARGE',
  'NAME',
];

export function sortSubscriptions(
  subscriptions: DetectedSubscription[],
  sortKey: SubscriptionSortKey,
): DetectedSubscription[] {
  return [...subscriptions].sort(COMPARATORS[sortKey]);
}
