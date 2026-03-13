export type SubscriptionFrequency = "WEEKLY" | "MONTHLY" | "YEARLY";
export type SubscriptionStatus = "DETECTED" | "CONFIRMED" | "DISMISSED";

export interface DetectedSubscription {
  id: string;
  merchantName: string;
  displayName: string;
  averageAmount: number;
  frequency: SubscriptionFrequency;
  lastChargeDate: string;
  nextExpectedDate: string;
  annualCost: number;
  status: SubscriptionStatus;
  matchingDescriptions: string[];
  scheduledTransactionId?: string;
  confidence: number;
}

export interface SubscriptionSummary {
  totalMonthlyEstimate: number;
  totalAnnualEstimate: number;
  activeCount: number;
  detectedCount: number;
  subscriptions: DetectedSubscription[];
}
