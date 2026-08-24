import { SubscriptionScheduleMatch } from '@/shared/types/subscription';
import { normalizeMerchantName } from '@/server/utils/merchantNormalizer';

export interface MatchableSchedule {
  id: string;
  description: string;
  value: number;
  scheduleType: SubscriptionScheduleMatch['scheduleType'];
  nextRunDate?: Date | null;
}

export interface IndexedSchedule {
  schedule: MatchableSchedule;
  merchantKey: string;
}

/** Normalizes once per request so the per-subscription scan stays regex-free. */
export function indexSchedules(
  schedules: MatchableSchedule[],
): IndexedSchedule[] {
  return schedules.map((schedule) => ({
    schedule,
    merchantKey: normalizeMerchantName(schedule.description),
  }));
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
  schedules: IndexedSchedule[],
): SubscriptionScheduleMatch | undefined {
  if (subscription.scheduledTransactionId) {
    const linked = schedules.find(
      ({ schedule }) => schedule.id === subscription.scheduledTransactionId,
    );
    if (linked) {
      return toMatch(linked.schedule, 'LINKED');
    }
  }

  const merchantKey = subscription.merchantName.trim();
  if (!merchantKey) {
    return undefined;
  }

  const byName = schedules.find(
    ({ merchantKey: scheduleKey }) =>
      scheduleKey &&
      (scheduleKey === merchantKey ||
        scheduleKey.includes(merchantKey) ||
        merchantKey.includes(scheduleKey)),
  );

  return byName ? toMatch(byName.schedule, 'NAME_MATCH') : undefined;
}
