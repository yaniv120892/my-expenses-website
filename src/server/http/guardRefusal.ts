import { NextResponse } from 'next/server';
import type { DailyBudgetDecision } from '@yaniv120892/app-kit/daily-budget';
import type { RateLimitCheck, RateLimitRefusal } from '@yaniv120892/app-kit/rate-limit';
import { RETRY_AFTER_HEADER } from '@yaniv120892/app-kit/rate-limit';
import { assertNever } from '@/utils/assertNever';
import { rateLimiter } from '@/server/guards';

type DailyBudgetRefusal = Extract<DailyBudgetDecision, { isAllowed: false }>;

type Refusal = { status: number; code: string; message: string; retryAfterSeconds?: number };

export const GUARD_REFUSAL_CODES = {
  RATE_LIMITED: 'RATE_LIMITED',
  DAILY_LIMIT_REACHED: 'DAILY_LIMIT_REACHED',
  TEMPORARILY_UNAVAILABLE: 'TEMPORARILY_UNAVAILABLE',
  DISABLED: 'FEATURE_DISABLED',
} as const;

const TEMPORARILY_UNAVAILABLE_MESSAGE = 'This is temporarily unavailable. Try again in a minute.';
const BUSY_TODAY_MESSAGE = 'This has reached its limit for today. Try again tomorrow.';
const DISABLED_MESSAGE = 'This is turned off for now.';

/** Spends each check in order; null when the request may go on, the refusal to answer when not. */
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

/**
 * Answered as a response, never thrown: a thrown 503 would be reported as a server error on every
 * request, while the guard already reports an outage once per interval.
 */
export function rateLimitRefusalResponse({
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
        code: GUARD_REFUSAL_CODES.RATE_LIMITED,
        message: overLimitMessage,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    case 'storeUnavailable':
      return refusalResponse({
        status: 503,
        code: GUARD_REFUSAL_CODES.TEMPORARILY_UNAVAILABLE,
        message: TEMPORARILY_UNAVAILABLE_MESSAGE,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    default:
      return assertNever({ value: decision.reason, what: 'rate limit refusal' });
  }
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
        code: GUARD_REFUSAL_CODES.DAILY_LIMIT_REACHED,
        message: subjectLimitMessage,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    case 'globalDailyLimit':
      return refusalResponse({
        status: 503,
        code: GUARD_REFUSAL_CODES.DAILY_LIMIT_REACHED,
        message: BUSY_TODAY_MESSAGE,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    case 'storeUnavailable':
      return refusalResponse({
        status: 503,
        code: GUARD_REFUSAL_CODES.TEMPORARILY_UNAVAILABLE,
        message: TEMPORARILY_UNAVAILABLE_MESSAGE,
        retryAfterSeconds: decision.retryAfterSeconds,
      });
    case 'disabled':
      return refusalResponse({
        status: 503,
        code: GUARD_REFUSAL_CODES.DISABLED,
        message: DISABLED_MESSAGE,
      });
    default:
      return assertNever({ value: decision, what: 'daily budget refusal' });
  }
}

function refusalResponse({ status, code, message, retryAfterSeconds }: Refusal): Response {
  const headers =
    retryAfterSeconds === undefined
      ? undefined
      : { [RETRY_AFTER_HEADER]: String(retryAfterSeconds) };
  return NextResponse.json({ error: message, message, code }, { status, headers });
}
