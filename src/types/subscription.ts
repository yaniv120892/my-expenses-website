import type {
  DetectedSubscriptionDomain,
  SubscriptionSummary as SharedSubscriptionSummary,
} from '@/shared/types/subscription';

export type SubscriptionFrequency = DetectedSubscriptionDomain['frequency'];
export type SubscriptionStatus = DetectedSubscriptionDomain['status'];

export type DetectedSubscription = Omit<
  DetectedSubscriptionDomain,
  'userId' | 'createdAt' | 'updatedAt' | 'lastChargeDate' | 'nextExpectedDate'
> & {
  lastChargeDate: string;
  nextExpectedDate: string;
};

export type SubscriptionSummary = Omit<
  SharedSubscriptionSummary,
  'subscriptions'
> & {
  subscriptions: DetectedSubscription[];
};
