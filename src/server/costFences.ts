import type { DailyBudget } from '@yaniv120892/app-kit/daily-budget';
import type { RateLimitPolicy } from '@yaniv120892/app-kit/rate-limit';
import { optionalPositiveIntegerEnv } from '@/server/env';

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;

export const CATEGORIZATION_HOUSEHOLD_DAILY_LIMIT = 200;
export const DEFAULT_CATEGORIZATION_GLOBAL_DAILY_LIMIT = 2000;

export const CHAT_USER_DAILY_LIMIT = 50;
export const DEFAULT_CHAT_GLOBAL_DAILY_LIMIT = 500;

export const STATEMENTS_PER_HOUR = 10;
export const STATEMENTS_PER_DAY = 30;

export const TEST_MONTHLY_REPORTS_PER_HOUR = 3;

export const STATEMENT_UPLOAD_RATE_LIMITS = statementPolicies('statement_upload');

/** Processing and re-matching share these: each sends a statement through paid model work. */
export const STATEMENT_PROCESSING_RATE_LIMITS = statementPolicies('statement_processing');

export const TEST_MONTHLY_REPORT_RATE_LIMIT = refusingPolicy({
  name: 'test_monthly_report',
  limit: TEST_MONTHLY_REPORTS_PER_HOUR,
  windowSeconds: HOUR_SECONDS,
});

/** `CATEGORIZATION_ENABLED=false` turns it off; read per call, so a dashboard edit applies at once. */
export function categorizationBudget(): DailyBudget {
  return envTunedBudget({
    feature: 'categorization',
    subjectLimit: CATEGORIZATION_HOUSEHOLD_DAILY_LIMIT,
    globalLimitEnv: 'CATEGORIZATION_GLOBAL_DAILY_LIMIT',
    defaultGlobalLimit: DEFAULT_CATEGORIZATION_GLOBAL_DAILY_LIMIT,
  });
}

/** `CHAT_ENABLED=false` turns the assistant off. */
export function chatBudget(): DailyBudget {
  return envTunedBudget({
    feature: 'chat',
    subjectLimit: CHAT_USER_DAILY_LIMIT,
    globalLimitEnv: 'CHAT_GLOBAL_DAILY_LIMIT',
    defaultGlobalLimit: DEFAULT_CHAT_GLOBAL_DAILY_LIMIT,
  });
}

function statementPolicies(name: string): RateLimitPolicy[] {
  return [
    refusingPolicy({
      name: `${name}_hour`,
      limit: STATEMENTS_PER_HOUR,
      windowSeconds: HOUR_SECONDS,
    }),
    refusingPolicy({ name: `${name}_day`, limit: STATEMENTS_PER_DAY, windowSeconds: DAY_SECONDS }),
  ];
}

/** Every paid fence refuses while its counter is down: an outage must not become unmetered spend. */
function refusingPolicy(policy: {
  name: string;
  limit: number;
  windowSeconds: number;
}): RateLimitPolicy {
  return { ...policy, whenStoreUnavailable: 'refuse' };
}

function envTunedBudget({
  feature,
  subjectLimit,
  globalLimitEnv,
  defaultGlobalLimit,
}: {
  feature: string;
  subjectLimit: number;
  globalLimitEnv: string;
  defaultGlobalLimit: number;
}): DailyBudget {
  return {
    feature,
    subjectLimit,
    globalLimit: optionalPositiveIntegerEnv({ name: globalLimitEnv, fallback: defaultGlobalLimit }),
  };
}
