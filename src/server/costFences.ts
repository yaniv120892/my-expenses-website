import type { DailyBudget } from '@yaniv120892/app-kit/daily-budget';
import type { RateLimitCheck, RateLimitPolicy } from '@yaniv120892/app-kit/rate-limit';
import { optionalPositiveIntegerEnv } from '@/server/env';
import type { HouseholdId } from '@/server/auth/householdActor.types';

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;

export const CATEGORIZATION_HOUSEHOLD_DAILY_LIMIT = 200;
export const DEFAULT_CATEGORIZATION_GLOBAL_DAILY_LIMIT = 2000;

export const CHAT_USER_DAILY_LIMIT = 50;
export const DEFAULT_CHAT_GLOBAL_DAILY_LIMIT = 500;

export const STATEMENT_LIMIT_MESSAGE = 'Too many statement imports. Try again later.';

// Every paid fence refuses while its counter is down: an outage must not become unmetered spend.
export const STATEMENT_UPLOAD_RATE_LIMITS: RateLimitPolicy[] = [
  {
    name: 'statement_upload_hour',
    limit: 10,
    windowSeconds: HOUR_SECONDS,
    whenStoreUnavailable: 'refuse',
  },
  {
    name: 'statement_upload_day',
    limit: 30,
    windowSeconds: DAY_SECONDS,
    whenStoreUnavailable: 'refuse',
  },
];

/** Processing and re-matching share these: each sends a statement through paid model work. */
export const STATEMENT_PROCESSING_RATE_LIMITS: RateLimitPolicy[] = [
  {
    name: 'statement_processing_hour',
    limit: 10,
    windowSeconds: HOUR_SECONDS,
    whenStoreUnavailable: 'refuse',
  },
  {
    name: 'statement_processing_day',
    limit: 30,
    windowSeconds: DAY_SECONDS,
    whenStoreUnavailable: 'refuse',
  },
];

export const TEST_MONTHLY_REPORT_RATE_LIMIT: RateLimitPolicy = {
  name: 'test_monthly_report',
  limit: 3,
  windowSeconds: HOUR_SECONDS,
  whenStoreUnavailable: 'refuse',
};

/** `CATEGORIZATION_ENABLED=false` turns it off; read per call, so a dashboard edit applies at once. */
export function categorizationBudget(): DailyBudget {
  return {
    feature: 'categorization',
    subjectLimit: CATEGORIZATION_HOUSEHOLD_DAILY_LIMIT,
    globalLimit: optionalPositiveIntegerEnv({
      name: 'CATEGORIZATION_GLOBAL_DAILY_LIMIT',
      fallback: DEFAULT_CATEGORIZATION_GLOBAL_DAILY_LIMIT,
    }),
  };
}

/** `CHAT_ENABLED=false` turns the assistant off. */
export function chatBudget(): DailyBudget {
  return {
    feature: 'chat',
    subjectLimit: CHAT_USER_DAILY_LIMIT,
    globalLimit: optionalPositiveIntegerEnv({
      name: 'CHAT_GLOBAL_DAILY_LIMIT',
      fallback: DEFAULT_CHAT_GLOBAL_DAILY_LIMIT,
    }),
  };
}

export function householdRateLimitChecks({
  policies,
  householdId,
}: {
  policies: RateLimitPolicy[];
  householdId: HouseholdId;
}): RateLimitCheck[] {
  return policies.map((policy) => ({ policy, clientId: `household:${householdId}` }));
}
