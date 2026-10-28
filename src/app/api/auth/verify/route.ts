import { NextResponse } from 'next/server';
import { createHandler } from '@/server/http/handler';
import { verifyLoginCodeSchema } from '@/shared/schemas/auth';
import authService from '@/server/services/authService';
import { setSessionCookie } from '@/server/auth/cookies';
import { captureProductEvent } from '@/server/productEvents';
import { RATE_LIMITS, resolveClientIp } from '@/server/http/rateLimit';

export const POST = createHandler({
  auth: 'public',
  bodySchema: verifyLoginCodeSchema,
  // Per-email guessing is already capped by loginCodeAttempts in
  // authService; this stops one host hammering many emails.
  rateLimit: ({ request }) => [
    { key: `verify:ip:${resolveClientIp(request)}`, ...RATE_LIMITS.verify },
  ],
  handler: async ({ body }) => {
    const result = await authService.verifyLoginCode(body.email, body.code);
    if (result.error || !result.token) {
      return NextResponse.json({ error: result.error ?? 'Verification failed' }, { status: 400 });
    }
    captureProductEvent(result.userId, { event: 'signed_up' });
    const response = NextResponse.json({ token: result.token });
    setSessionCookie(response, result.token);
    return response;
  },
});
