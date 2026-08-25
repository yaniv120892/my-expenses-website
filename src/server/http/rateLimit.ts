import { NextRequest } from 'next/server';
import { incrementManyWithTtl } from '@/server/redis';
import { HttpError } from '@/server/http/errors';
import logger from '@/server/logging/logger';

export type RateLimitRule = {
  key: string;
  limit: number;
  windowSeconds: number;
};

// The whole rate-limit posture on one screen. Keys are built at the route,
// where the identity being limited (IP, email, user) is known.
export const RATE_LIMITS = {
  login: { limit: 10, windowSeconds: 900 },
  signup: { limit: 5, windowSeconds: 3600 },
  verify: { limit: 20, windowSeconds: 900 },
  chat: { limit: 20, windowSeconds: 300 },
  testTelegram: { limit: 5, windowSeconds: 3600 },
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
    // Redis being unreachable must not take auth or chat down with it: fail
    // open, logged per request — an attacker who can break Redis gets a pass.
    logger.error(
      { err: error },
      'Rate limit check failed; allowing the request',
    );
    return;
  }
  const tripped = rules.find((rule, index) => counts[index] > rule.limit);
  if (tripped) {
    // warn ships to Better Stack, so "were we attacked?" stays answerable
    // after Vercel's one-hour log retention; no Sentry or alert-quota cost.
    logger.warn(
      { key: tripped.key, limit: tripped.limit },
      'Rate limit exceeded',
    );
    throw new HttpError(429, 'Too many requests. Try again later.');
  }
}

export function resolveClientIp(request: NextRequest): string {
  // x-vercel-forwarded-for is set by the platform and cannot be spoofed by
  // the client; plain x-forwarded-for is the local/proxy fallback. Off
  // Vercel, absent headers collapse everyone into one shared bucket —
  // accepted, since Vercel is the only deploy target.
  const forwarded =
    request.headers.get('x-vercel-forwarded-for') ??
    request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}
