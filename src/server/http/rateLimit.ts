import { NextRequest } from 'next/server';
import { incrementWithTtl } from '@/server/redis';
import { HttpError } from '@/server/http/errors';
import logger from '@/server/logging/logger';

// Fixed-window counter over the existing Redis increment helper. Redis being
// unreachable must not take auth or chat down with it, so the limiter fails
// open — logged loudly, since an attacker who can break Redis gets a pass.
export async function enforceRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  let count: number;
  try {
    count = await incrementWithTtl(`rateLimit:${key}`, windowSeconds);
  } catch (error) {
    logger.error(
      { err: error, key },
      'Rate limit check failed; allowing the request',
    );
    return;
  }
  // A backend that answers INCR with a non-number (a stub, a proxy error
  // body) must not silently disable the limit without a trace.
  if (!Number.isFinite(count)) {
    logger.error({ key, count }, 'Rate limit count is not a number; allowing');
    return;
  }
  if (count > limit) {
    throw new HttpError(429, 'Too many requests. Try again later.');
  }
}

export function clientIp(request: NextRequest): string {
  // Vercel appends the real client to x-forwarded-for; the first entry is it.
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}
