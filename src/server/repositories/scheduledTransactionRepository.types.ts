import type { HouseholdId } from '@/server/auth/householdActor.types';
import type { ScheduledTransactionDomain } from '@/shared/types/scheduledTransaction';

// The household rides along so a cron acting on a due row stays inside it.
export type ScheduledHouseholdTransaction = ScheduledTransactionDomain & {
  householdId: HouseholdId;
};
