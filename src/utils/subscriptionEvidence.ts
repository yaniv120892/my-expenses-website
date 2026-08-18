import { format } from 'date-fns';
import {
  DetectedSubscription,
  SubscriptionEvidence,
} from '@/types/subscription';
import { formatCurrency } from '@/utils/format';

const FREQUENCY_LABEL: Record<string, string> = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
};

export function formatDay(value: string): string {
  return format(new Date(value), 'MMM d, yyyy');
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Gap in days between each charge and the one before it. Charges arrive newest
 * first, so the last row — the oldest charge — has no predecessor.
 */
export function daysBetweenCharges(
  charges: { date: string }[],
): (number | null)[] {
  return charges.map((charge, index) => {
    const previous = charges[index + 1];
    if (!previous) return null;
    return Math.round(
      (new Date(charge.date).getTime() - new Date(previous.date).getTime()) /
        MS_PER_DAY,
    );
  });
}

/** Plain-language reasons the detector accepted this merchant as recurring. */
export function buildEvidenceReasons(
  subscription: DetectedSubscription,
  evidence: SubscriptionEvidence,
): string[] {
  const frequencyLabel =
    FREQUENCY_LABEL[subscription.frequency] ?? subscription.frequency;
  const reasons = [
    `${evidence.chargeCount} charges matched the merchant "${evidence.merchantKey}" between ${formatDay(evidence.firstChargeDate)} and ${formatDay(evidence.lastChargeDate)}.`,
    `They arrive about every ${evidence.medianIntervalDays} days, which falls inside the ${frequencyLabel} window of ${evidence.frequencyWindowDays.min}–${evidence.frequencyWindowDays.max} days.`,
    `The spacing varies by ${evidence.intervalStdDevDays} days (${Math.round(evidence.intervalVariationRatio * 100)}% of the typical gap) — detection rejects anything above ${Math.round(evidence.intervalToleranceRatio * 100)}%.`,
  ];

  reasons.push(
    evidence.minAmount === evidence.maxAmount
      ? `Every charge was ${formatCurrency(evidence.minAmount)}.`
      : `Charges ranged from ${formatCurrency(evidence.minAmount)} to ${formatCurrency(evidence.maxAmount)}, averaging ${formatCurrency(evidence.averageAmount)}.`,
  );

  reasons.push(
    `That gives a confidence of ${Math.round(subscription.confidence * 100)}%.`,
  );

  return reasons;
}
