import {
  ScheduleType,
  SubscriptionFrequency,
  SubscriptionStatus,
} from '@prisma/client';

export interface SubscriptionEvidenceCharge {
  date: string;
  amount: number;
  description: string;
}

/**
 * The detector's own working figures, stored so the app can explain why a
 * merchant was flagged instead of asking the user to trust a score.
 */
export interface SubscriptionDetectionEvidence {
  version: number;
  detectedAt: string;
  merchantKey: string;
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
}

/**
 * A scheduled transaction that already covers this subscription — either the
 * one a conversion created (LINKED) or one whose description normalizes to the
 * same merchant (NAME_MATCH).
 */
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
  scheduleMatch?: SubscriptionScheduleMatch;
  categoryId?: string;
  categoryName?: string;
  detectionEvidence?: SubscriptionDetectionEvidence;
  userEditedAt?: Date;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionSummary {
  totalMonthlyEstimate: number;
  totalAnnualEstimate: number;
  activeCount: number;
  detectedCount: number;
  subscriptions: DetectedSubscriptionDomain[];
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
