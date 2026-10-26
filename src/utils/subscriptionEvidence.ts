import { differenceInCalendarDays } from 'date-fns';
import {
  DetectedSubscription,
  SubscriptionEvidenceCharge,
} from '@/types/subscription';
import type { SubscriptionDetectionEvidence } from '@/shared/types/subscription';
import type { AppFormatter } from '@/i18n/useAppFormat';
import type { T } from '@/i18n/useT';

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

export function buildEvidenceReasons({
  subscription,
  evidence,
  t,
  formatter,
}: {
  subscription: DetectedSubscription;
  evidence: SubscriptionDetectionEvidence;
  t: T;
  formatter: AppFormatter;
}): string[] {
  const frequencyLabel = formatter
    .frequency(subscription.frequency)
    .toLocaleLowerCase();

  return [
    t('subscriptions.reason.matched', {
      count: evidence.chargeCount,
      merchant: subscription.merchantName,
      from: formatter.day(evidence.firstChargeDate),
      to: formatter.day(evidence.lastChargeDate),
    }),
    t('subscriptions.reason.interval', {
      days: evidence.medianIntervalDays,
      frequency: frequencyLabel,
      min: evidence.frequencyWindowDays.min,
      max: evidence.frequencyWindowDays.max,
    }),
    t('subscriptions.reason.spacing', {
      days: formatter.number(evidence.intervalStdDevDays),
      ratio: Math.round(evidence.intervalVariationRatio * 100),
      tolerance: Math.round(evidence.intervalToleranceRatio * 100),
    }),
    evidence.minAmount === evidence.maxAmount
      ? t('subscriptions.reason.sameAmount', {
          amount: formatter.currency(evidence.minAmount),
        })
      : t('subscriptions.reason.amountRange', {
          min: formatter.currency(evidence.minAmount),
          max: formatter.currency(evidence.maxAmount),
          average: formatter.currency(evidence.averageAmount),
        }),
    t('subscriptions.reason.confidence', {
      confidence: Math.round(subscription.confidence * 100),
    }),
  ];
}
