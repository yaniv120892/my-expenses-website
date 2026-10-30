import type { HouseholdId } from '@/server/auth/householdActor.types';

export type ScheduledReport = 'dailySummary' | 'monthlyReport' | 'subscriptionAudit';

export type ReportRecipient = { userId: string; householdId: HouseholdId };
