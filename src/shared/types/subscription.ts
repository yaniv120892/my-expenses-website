import {
  ScheduleType,
  SubscriptionFrequency,
  SubscriptionStatus,
} from '@prisma/client';

export type SubscriptionEvidenceCharge = {
  date: string;
  amount: number;
  description: string;
};

// Stored so the app can explain why a merchant was flagged. A type rather than
// an interface so it satisfies Prisma's Json input without a cast.
export type SubscriptionDetectionEvidence = {
  analyzedFrom: string;
  analyzedTo: string;
  chargeCount: number;
  firstChargeDate: string;
  lastChargeDate: string;
  medianIntervalDays: number;
  minIntervalDays: number;
  maxIntervalDays: number;
  intervalStdDevDays: number;
  intervalVariationRatio: number;
  intervalToleranceRatio: number;
  frequencyWindowDays: { min: number; max: number };
  minAmount: number;
  maxAmount: number;
  averageAmount: number;
  recentCharges: SubscriptionEvidenceCharge[];
  olderChargeCount: number;
};

// LINKED: the schedule a conversion created; NAME_MATCH: one whose description
// normalizes to the same merchant.
export interface SubscriptionScheduleMatch {
  id: string;
  description: string;
  value: number;
  scheduleType: ScheduleType;
  nextRunDate?: Date;
  matchType: 'LINKED' | 'NAME_MATCH';
}

export interface DetectedSubscriptionDomain {
  id: string;
  userId: string;
  merchantName: string;
  displayName: string;
  averageAmount: number;
  frequency: SubscriptionFrequency;
  lastChargeDate: Date;
  nextExpectedDate: Date;
  annualCost: number;
  monthlyCost: number;
  status: SubscriptionStatus;
  matchingDescriptions: string[];
  scheduledTransactionId?: string;
  categoryId?: string;
  categoryName?: string;
  detectionEvidence?: SubscriptionDetectionEvidence;
  userEditedAt?: Date;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionListItem extends DetectedSubscriptionDomain {
  scheduleMatch?: SubscriptionScheduleMatch;
}

export interface SubscriptionSummary {
  totalMonthlyEstimate: number;
  totalAnnualEstimate: number;
  activeCount: number;
  detectedCount: number;
  subscriptions: SubscriptionListItem[];
}

export interface SubscriptionDashboardSnapshot {
  activeCount: number;
  totalMonthlyEstimate: number;
  totalAnnualEstimate: number;
  detectedCount: number;
}

export interface UpdateSubscriptionInput {
  displayName?: string;
  averageAmount?: number;
  frequency?: SubscriptionFrequency;
  lastChargeDate?: Date;
  nextExpectedDate?: Date;
  categoryId?: string | null;
}
