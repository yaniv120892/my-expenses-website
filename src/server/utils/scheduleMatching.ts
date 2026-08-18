import { SubscriptionScheduleMatch } from '@/shared/types/subscription';
import { normalizeMerchantName } from '@/server/utils/merchantNormalizer';

export interface MatchableSchedule {
  id: string;
  description: string;
  value: number;
  scheduleType: SubscriptionScheduleMatch['scheduleType'];
  nextRunDate?: Date | null;
}

function toMatch(
  schedule: MatchableSchedule,
  matchType: SubscriptionScheduleMatch['matchType'],
): SubscriptionScheduleMatch {
  return {
    id: schedule.id,
    description: schedule.description,
    value: schedule.value,
    scheduleType: schedule.scheduleType,
    nextRunDate: schedule.nextRunDate ?? undefined,
    matchType,
  };
}

/**
 * Finds the scheduled transaction that already covers a subscription: the one
 * a conversion linked, otherwise one whose description normalizes to the same
 * merchant (or contains it, so "Netflix" matches "Netflix subscription").
 */
export function findScheduleMatch(
  subscription: { merchantName: string; scheduledTransactionId?: string },
  schedules: MatchableSchedule[],
): SubscriptionScheduleMatch | undefined {
  if (subscription.scheduledTransactionId) {
    const linked = schedules.find(
      (schedule) => schedule.id === subscription.scheduledTransactionId,
    );
    if (linked) return toMatch(linked, 'LINKED');
  }

  const merchantKey = subscription.merchantName.trim();
  if (!merchantKey) return undefined;

  const byName = schedules.find((schedule) => {
    const scheduleKey = normalizeMerchantName(schedule.description);
    if (!scheduleKey) return false;
    return (
      scheduleKey === merchantKey ||
      scheduleKey.includes(merchantKey) ||
      merchantKey.includes(scheduleKey)
    );
  });

  return byName ? toMatch(byName, 'NAME_MATCH') : undefined;
}
