import { NextResponse } from 'next/server';
import type { DailyBudgetDecision } from '@yaniv120892/app-kit/daily-budget';
import type {
  RateLimitCheck,
  RateLimitPolicy,
  RateLimitRefusal,
} from '@yaniv120892/app-kit/rate-limit';
import { RETRY_AFTER_HEADER } from '@yaniv120892/app-kit/rate-limit';
import { assertNever } from '@/utils/assertNever';
import { rateLimiter } from '@/server/guards';
import { jsonErrorBody } from '@/server/http/errors';
import type { HouseholdId } from '@/server/auth/householdActor.types';

type DailyBudgetRefusal = Extract<DailyBudgetDecision, { isAllowed: false }>;

type Refusal = { status: number; code: string; message: string; retryAfterSeconds?: number };

const REFUSAL_CODES = {
  RATE_LIMITED: 'RATE_LIMITED',
  DAILY_LIMIT_REACHED: 'DAILY_LIMIT_REACHED',
  TEMPORARILY_UNAVAILABLE: 'TEMPORARILY_UNAVAILABLE',
  DISABLED: 'FEATURE_DISABLED',
} as const;

const STATEMENT_LIMIT_MESSAGE = 'Too many statement imports. Try again later.';
const TEMPORARILY_UNAVAILABLE_MESSAGE = 'This is temporarily unavailable. Try again in a minute.';
const BUSY_TODAY_MESSAGE = 'This has reached its limit for today. Try again tomorrow.';
const DISABLED_MESSAGE = 'This is turned off for now.';

/*
 * Every refusal here is answered as a response, never thrown: a thrown 503 would be reported as a
 * server error on every request, while the guard already reports an outage once per interval.
 */

export async function refuseIfRateLimited({
  checks,
  overLimitMessage,
}: {
  checks: RateLimitCheck[];
  overLimitMessage: string;
}): Promise<Response | null> {
  const decision = await rateLimiter.checkAll({ checks });
  return decision.isAllowed ? null : rateLimitRefusalResponse({ decision, overLimitMessage });
}

/** Statement limits count the household, so its members share one allowance. */
export function refuseIfStatementLimited({
  policies,
  householdId,
}: {
  policies: RateLimitPolicy[];
  householdId: HouseholdId;
}): Promise<Response | null> {
  return refuseIfRateLimited({
    checks: policies.map((policy) => ({ policy, clientId: `household:${householdId}` })),
    overLimitMessage: STATEMENT_LIMIT_MESSAGE,
  });
}

export function dailyBudgetRefusalResponse({
  decision,
  subjectLimitMessage,
}: {
  decision: DailyBudgetRefusal;
  subjectLimitMessage: string;
}): Response {
  switch (decision.reason) {
    case 'subjectDailyLimit':
      return refusalResponse({
        status: 429,
        code: REFUSAL_CODES.DAILY_LIMIT_REACHED,
        message: subjectLimitMessage,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    case 'globalDailyLimit':
      return refusalResponse({
        status: 503,
        code: REFUSAL_CODES.DAILY_LIMIT_REACHED,
        message: BUSY_TODAY_MESSAGE,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    case 'storeUnavailable':
      return storeUnavailableResponse(decision.retryAfterSeconds);
    case 'disabled':
      return refusalResponse({
        status: 503,
        code: REFUSAL_CODES.DISABLED,
        message: DISABLED_MESSAGE,
      });
    default:
      return assertNever({ value: decision, what: 'daily budget refusal' });
  }
}

function rateLimitRefusalResponse({
  decision,
  overLimitMessage,
}: {
  decision: RateLimitRefusal;
  overLimitMessage: string;
}): Response {
  switch (decision.reason) {
    case 'overLimit':
      return refusalResponse({
        status: 429,
        code: REFUSAL_CODES.RATE_LIMITED,
        message: overLimitMessage,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    case 'storeUnavailable':
      return storeUnavailableResponse(decision.retryAfterSeconds);
    default:
      return assertNever({ value: decision.reason, what: 'rate limit refusal' });
  }
}

function storeUnavailableResponse(retryAfterSeconds: number): Response {
  return refusalResponse({
    status: 503,
    code: REFUSAL_CODES.TEMPORARILY_UNAVAILABLE,
    message: TEMPORARILY_UNAVAILABLE_MESSAGE,
    retryAfterSeconds,
  });
}

function refusalResponse({ status, code, message, retryAfterSeconds }: Refusal): Response {
  const headers =
    retryAfterSeconds === undefined
      ? undefined
      : { [RETRY_AFTER_HEADER]: String(retryAfterSeconds) };
  return NextResponse.json(jsonErrorBody({ message, code }), { status, headers });
}
