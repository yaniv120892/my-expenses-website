import type {
  DetectedSubscriptionDomain,
  SubscriptionListItem,
  SubscriptionScheduleMatch,
  SubscriptionSummary as SharedSubscriptionSummary,
} from '@/shared/types/subscription';

export type { SubscriptionEvidenceCharge } from '@/shared/types/subscription';

export type SubscriptionFrequency = DetectedSubscriptionDomain['frequency'];
export type SubscriptionStatus = DetectedSubscriptionDomain['status'];

export type ScheduleMatch = Omit<SubscriptionScheduleMatch, 'nextRunDate'> & {
  nextRunDate?: string;
};

export type DetectedSubscription = Omit<
  SubscriptionListItem,
  | 'userId'
  | 'createdAt'
  | 'updatedAt'
  | 'lastChargeDate'
  | 'nextExpectedDate'
  | 'userEditedAt'
  | 'scheduleMatch'
> & {
  lastChargeDate: string;
  nextExpectedDate: string;
  userEditedAt?: string;
  scheduleMatch?: ScheduleMatch;
};

export type SubscriptionSummary = Omit<
  SharedSubscriptionSummary,
  'subscriptions'
> & {
  subscriptions: DetectedSubscription[];
};

export interface UpdateSubscriptionPayload {
  displayName?: string;
  averageAmount?: number;
  frequency?: SubscriptionFrequency;
  lastChargeDate?: string;
  nextExpectedDate?: string;
  categoryId?: string | null;
}
