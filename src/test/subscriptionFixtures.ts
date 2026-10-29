import type { DetectedSubscription } from '@/types/subscription';
import type { SubscriptionDetectionEvidence } from '@/shared/types/subscription';

export function buildDetectedSubscription(
  overrides: Partial<DetectedSubscription> = {},
): DetectedSubscription {
  return {
    id: 'id',
    merchantName: 'merchant',
    displayName: 'Merchant',
    averageAmount: 10,
    frequency: 'MONTHLY',
    lastChargeDate: '2026-08-04T00:00:00.000Z',
    nextExpectedDate: '2026-09-04T00:00:00.000Z',
    annualCost: 120,
    monthlyCost: 10,
    status: 'DETECTED',
    matchingDescriptions: [],
    confidence: 0.9,
    ...overrides,
  };
}

export function buildDetectionEvidence(
  overrides: Partial<SubscriptionDetectionEvidence> = {},
): SubscriptionDetectionEvidence {
  return {
    analyzedFrom: '2025-08-18T00:00:00.000Z',
    analyzedTo: '2026-08-18T00:00:00.000Z',
    chargeCount: 4,
    firstChargeDate: '2026-05-04T00:00:00.000Z',
    lastChargeDate: '2026-08-04T00:00:00.000Z',
    medianIntervalDays: 31,
    minIntervalDays: 30,
    maxIntervalDays: 31,
    intervalStdDevDays: 0.5,
    intervalVariationRatio: 0.02,
    intervalToleranceRatio: 0.3,
    frequencyWindowDays: { min: 25, max: 35 },
    minAmount: 49.9,
    maxAmount: 49.9,
    averageAmount: 49.9,
    recentCharges: [],
    olderChargeCount: 0,
    ...overrides,
  };
}
