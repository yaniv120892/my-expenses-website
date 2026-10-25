import { NextRequest } from 'next/server';
import { incrementManyWithTtl } from '@/server/redis';
import { HttpError } from '@/server/http/errors';
import logger from '@/server/logging/logger';
import { reportSwallowedError } from '@/server/logging/reportSwallowedError';

export type RateLimitRule = {
  key: string;
  limit: number;
  windowSeconds: number;
};

export const RATE_LIMITS = {
  login: { limit: 10, windowSeconds: 900 },
  signup: { limit: 5, windowSeconds: 3600 },
  // Above the per-host limit: any per-address cap is one a stranger can spend
  // to keep the owner from being mailed a code, so it only bounds the flood.
  signupPerAddress: { limit: 20, windowSeconds: 3600 },
  verify: { limit: 20, windowSeconds: 900 },
  chat: { limit: 20, windowSeconds: 300 },
  testTelegram: { limit: 5, windowSeconds: 3600 },
  // A single agent turn runs initialize, tools/list and its tool calls, each
  // its own stateless request.
  mcp: { limit: 300, windowSeconds: 300 },
} satisfies Record<string, { limit: number; windowSeconds: number }>;

export async function enforceRateLimits(rules: RateLimitRule[]): Promise<void> {
  if (rules.length === 0) {
    return;
  }
  let counts: number[];
  try {
    counts = await incrementManyWithTtl(
      rules.map((rule) => ({
        key: `rateLimit:${rule.key}`,
        ttlSeconds: rule.windowSeconds,
      })),
    );
  } catch (error) {
    // Fail open so a Redis outage cannot take auth or chat down; reported so it
    // stays visible.
    reportSwallowedError(
      { err: error },
      'Rate limit check failed; allowing the request',
    );
    return;
  }
  const tripped = rules.find((rule, index) => counts[index] > rule.limit);
  if (tripped) {
    // At warn so it ships, keeping an attack visible past runtime log
    // retention.
    logger.warn(
      { key: tripped.key, limit: tripped.limit },
      'Rate limit exceeded',
    );
    throw new HttpError(429, 'Too many requests. Try again later.');
  }
}

export function resolveClientIp(request: NextRequest): string {
  // x-vercel-forwarded-for is set by the platform and cannot be spoofed. Off
  // Vercel, absent headers collapse everyone into one bucket.
  const forwarded =
    request.headers.get('x-vercel-forwarded-for') ??
    request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}
