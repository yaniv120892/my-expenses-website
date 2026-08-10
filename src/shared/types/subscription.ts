import { SubscriptionFrequency, SubscriptionStatus } from '@prisma/client';

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
  status: SubscriptionStatus;
  matchingDescriptions: string[];
  scheduledTransactionId?: string;
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
