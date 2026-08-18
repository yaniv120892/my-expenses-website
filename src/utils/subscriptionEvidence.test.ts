import { describe, expect, it } from 'vitest';
import {
  DetectedSubscription,
  SubscriptionEvidence,
} from '@/types/subscription';
import {
  buildEvidenceReasons,
  daysBetweenCharges,
} from '@/utils/subscriptionEvidence';

const evidence = (over: Partial<SubscriptionEvidence> = {}) =>
  ({
    version: 1,
    detectedAt: '2026-08-18T00:00:00.000Z',
    merchantKey: 'netflix',
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
    ...over,
  }) as SubscriptionEvidence;

const subscription = {
  frequency: 'MONTHLY',
  confidence: 0.98,
} as DetectedSubscription;

describe('buildEvidenceReasons', () => {
  it('states the charge count, merchant and date span', () => {
    const [first] = buildEvidenceReasons(subscription, evidence());
    expect(first).toContain('4 charges');
    expect(first).toContain('netflix');
    expect(first).toContain('May 4, 2026');
    expect(first).toContain('Aug 4, 2026');
  });

  it('names the frequency window the typical gap fell into', () => {
    const reasons = buildEvidenceReasons(subscription, evidence());
    expect(reasons[1]).toContain('every 31 days');
    expect(reasons[1]).toContain('monthly window of 25–35 days');
  });

  it('compares the spacing variation against the tolerance', () => {
    const reasons = buildEvidenceReasons(subscription, evidence());
    expect(reasons[2]).toContain('varies by 0.5 days');
    expect(reasons[2]).toContain('2% of the typical gap');
    expect(reasons[2]).toContain('above 30%');
  });

  it('says the amount was identical when it never moved', () => {
    const reasons = buildEvidenceReasons(subscription, evidence());
    expect(reasons[3]).toContain('Every charge was');
  });

  it('reports the range when amounts differ', () => {
    const reasons = buildEvidenceReasons(
      subscription,
      evidence({ minAmount: 40, maxAmount: 60, averageAmount: 50 }),
    );
    expect(reasons[3]).toContain('ranged from');
    expect(reasons[3]).toContain('averaging');
  });

  it('closes with the confidence percentage', () => {
    const reasons = buildEvidenceReasons(subscription, evidence());
    expect(reasons[reasons.length - 1]).toContain('98%');
  });
});

describe('daysBetweenCharges', () => {
  it('measures each newest-first charge against the one before it', () => {
    expect(
      daysBetweenCharges([
        { date: '2026-08-04T00:00:00.000Z' },
        { date: '2026-07-04T00:00:00.000Z' },
        { date: '2026-06-04T00:00:00.000Z' },
      ]),
    ).toEqual([31, 30, null]);
  });

  it('returns a single null for one charge', () => {
    expect(daysBetweenCharges([{ date: '2026-08-04T00:00:00.000Z' }])).toEqual([
      null,
    ]);
  });

  it('handles an empty list', () => {
    expect(daysBetweenCharges([])).toEqual([]);
  });
});
