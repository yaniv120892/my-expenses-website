import type {
  DetectedSubscriptionDomain,
  SubscriptionDetectionEvidence,
  SubscriptionScheduleMatch,
  SubscriptionSummary as SharedSubscriptionSummary,
} from '@/shared/types/subscription';

export type SubscriptionFrequency = DetectedSubscriptionDomain['frequency'];
export type SubscriptionStatus = DetectedSubscriptionDomain['status'];
export type SubscriptionEvidence = SubscriptionDetectionEvidence;

export type ScheduleMatch = Omit<SubscriptionScheduleMatch, 'nextRunDate'> & {
  nextRunDate?: string;
};

export type DetectedSubscription = Omit<
  DetectedSubscriptionDomain,
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
