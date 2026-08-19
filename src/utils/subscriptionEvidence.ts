import { differenceInCalendarDays } from 'date-fns';
import {
  DetectedSubscription,
  SubscriptionEvidenceCharge,
} from '@/types/subscription';
import type { SubscriptionDetectionEvidence } from '@/shared/types/subscription';
import { formatCurrency, formatSubscriptionFrequency } from '@/utils/format';
import { formatDay } from '@/utils/dateUtils';

export type ChargeWithGap = SubscriptionEvidenceCharge & {
  /** Days since the charge before it; null for the oldest one listed. */
  gapDays: number | null;
};

/** Charges arrive newest first, so each row's predecessor is the next one. */
export function withChargeGaps(
  charges: SubscriptionEvidenceCharge[],
): ChargeWithGap[] {
  return charges.map((charge, index) => {
    const previous = charges[index + 1];
    return {
      ...charge,
      gapDays: previous
        ? differenceInCalendarDays(
            new Date(charge.date),
            new Date(previous.date),
          )
        : null,
    };
  });
}

export function buildEvidenceReasons(
  subscription: DetectedSubscription,
  evidence: SubscriptionDetectionEvidence,
): string[] {
  const frequencyLabel = formatSubscriptionFrequency(
    subscription.frequency,
  ).toLowerCase();

  return [
    `${evidence.chargeCount} charges matched the merchant "${subscription.merchantName}" between ${formatDay(evidence.firstChargeDate)} and ${formatDay(evidence.lastChargeDate)}.`,
    `They arrive about every ${evidence.medianIntervalDays} days, which falls inside the ${frequencyLabel} window of ${evidence.frequencyWindowDays.min}–${evidence.frequencyWindowDays.max} days.`,
    `The spacing varies by ${evidence.intervalStdDevDays} days (${Math.round(evidence.intervalVariationRatio * 100)}% of the typical gap) — detection rejects anything above ${Math.round(evidence.intervalToleranceRatio * 100)}%.`,
    evidence.minAmount === evidence.maxAmount
      ? `Every charge was ${formatCurrency(evidence.minAmount)}.`
      : `Charges ranged from ${formatCurrency(evidence.minAmount)} to ${formatCurrency(evidence.maxAmount)}, averaging ${formatCurrency(evidence.averageAmount)}.`,
    `That gives a confidence of ${Math.round(subscription.confidence * 100)}%.`,
  ];
}
