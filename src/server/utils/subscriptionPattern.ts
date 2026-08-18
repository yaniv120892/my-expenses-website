import { SubscriptionFrequency } from '@prisma/client';
import {
  SubscriptionDetectionEvidence,
  SubscriptionEvidenceCharge,
} from '@/shared/types/subscription';
import { toDisplayName } from '@/server/utils/merchantNormalizer';
import {
  nextExpectedDateAfter,
  roundToCents,
  toAnnualAmount,
} from '@/utils/subscriptionMath';

export const MIN_CHARGES_FOR_PATTERN = 3;
export const INTERVAL_TOLERANCE_RATIO = 0.3;
const MAX_EVIDENCE_CHARGES = 12;
// Intervals stay fractional so the standard deviation can see sub-day drift,
// which date-fns' whole-day helpers would round away.
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const FREQUENCY_WINDOW_DAYS: Record<
  SubscriptionFrequency,
  { min: number; max: number }
> = {
  WEEKLY: { min: 5, max: 9 },
  MONTHLY: { min: 25, max: 35 },
  YEARLY: { min: 340, max: 395 },
};

export interface MerchantCharge {
  description: string;
  value: number;
  date: Date;
  categoryId?: string;
}

export interface MerchantGroup {
  merchantKey: string;
  charges: MerchantCharge[];
}

export interface DetectedPattern {
  merchantKey: string;
  displayName: string;
  frequency: SubscriptionFrequency;
  averageAmount: number;
  lastChargeDate: Date;
  nextExpectedDate: Date;
  annualCost: number;
  descriptions: string[];
  confidence: number;
  categoryId?: string;
  evidence: SubscriptionDetectionEvidence;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length / 2;
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[Math.floor(middle)];
}

function standardDeviation(values: number[], center: number): number {
  const variance =
    values.reduce((sum, value) => sum + Math.pow(value - center, 2), 0) /
    values.length;
  return Math.sqrt(variance);
}

/** The value appearing most often; ties go to the one seen first. */
function mostCommon<T>(values: (T | undefined)[]): T | undefined {
  const counts = new Map<T, number>();
  for (const value of values) {
    if (value === undefined) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  let winner: T | undefined;
  let maxCount = 0;
  for (const [value, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      winner = value;
    }
  }
  return winner;
}

export function classifyFrequency(
  medianDays: number,
): SubscriptionFrequency | null {
  const match = Object.entries(FREQUENCY_WINDOW_DAYS).find(
    ([, window]) => medianDays >= window.min && medianDays <= window.max,
  );
  return match ? (match[0] as SubscriptionFrequency) : null;
}

function toEvidenceCharges(
  charges: MerchantCharge[],
): SubscriptionEvidenceCharge[] {
  return charges
    .slice(-MAX_EVIDENCE_CHARGES)
    .reverse()
    .map((charge) => ({
      date: charge.date.toISOString(),
      amount: roundToCents(charge.value),
      description: charge.description,
    }));
}

export function analyzeMerchantPattern(
  group: MerchantGroup,
  analyzedFrom: Date,
  analyzedTo: Date,
): DetectedPattern | null {
  if (group.charges.length < MIN_CHARGES_FOR_PATTERN) return null;

  const charges = [...group.charges].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  const intervals: number[] = [];
  for (let i = 1; i < charges.length; i++) {
    intervals.push(
      (charges[i].date.getTime() - charges[i - 1].date.getTime()) / MS_PER_DAY,
    );
  }

  const medianInterval = median(intervals);
  const stddev = standardDeviation(intervals, medianInterval);
  const variationRatio = medianInterval > 0 ? stddev / medianInterval : 0;

  const frequency = classifyFrequency(medianInterval);
  if (!frequency) return null;
  if (variationRatio > INTERVAL_TOLERANCE_RATIO) return null;

  const amounts = charges.map((charge) => charge.value);
  const descriptions = charges.map((charge) => charge.description);
  const averageAmount =
    amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
  const lastChargeDate = charges[charges.length - 1].date;
  const confidence = Math.max(0, Math.min(1, 1 - variationRatio));

  const evidence: SubscriptionDetectionEvidence = {
    analyzedFrom: analyzedFrom.toISOString(),
    analyzedTo: analyzedTo.toISOString(),
    chargeCount: charges.length,
    firstChargeDate: charges[0].date.toISOString(),
    lastChargeDate: lastChargeDate.toISOString(),
    medianIntervalDays: Math.round(medianInterval * 10) / 10,
    minIntervalDays: Math.round(Math.min(...intervals) * 10) / 10,
    maxIntervalDays: Math.round(Math.max(...intervals) * 10) / 10,
    intervalStdDevDays: Math.round(stddev * 10) / 10,
    intervalVariationRatio: Math.round(variationRatio * 100) / 100,
    intervalToleranceRatio: INTERVAL_TOLERANCE_RATIO,
    frequencyWindowDays: FREQUENCY_WINDOW_DAYS[frequency],
    minAmount: roundToCents(Math.min(...amounts)),
    maxAmount: roundToCents(Math.max(...amounts)),
    averageAmount: roundToCents(averageAmount),
    recentCharges: toEvidenceCharges(charges),
    olderChargeCount: Math.max(0, charges.length - MAX_EVIDENCE_CHARGES),
  };

  return {
    merchantKey: group.merchantKey,
    displayName: toDisplayName(
      mostCommon(descriptions.map((d) => d.trim())) ?? descriptions[0],
    ),
    frequency,
    averageAmount: roundToCents(averageAmount),
    lastChargeDate,
    nextExpectedDate: nextExpectedDateAfter(lastChargeDate, frequency),
    annualCost: roundToCents(toAnnualAmount(averageAmount, frequency)),
    descriptions: [...new Set(descriptions)],
    confidence: Math.round(confidence * 100) / 100,
    categoryId: mostCommon(charges.map((charge) => charge.categoryId)),
    evidence,
  };
}
