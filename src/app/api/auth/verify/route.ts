import { NextResponse } from 'next/server';
import { createHandler } from '@/server/http/handler';
import { verifyLoginCodeSchema } from '@/shared/schemas/auth';
import authService from '@/server/services/authService';
import { setSessionCookie } from '@/server/auth/cookies';
import { RATE_LIMITS, resolveClientIp } from '@/server/http/rateLimit';

export const POST = createHandler({
  auth: 'public',
  bodySchema: verifyLoginCodeSchema,
  // Per-email guessing is already capped by loginCodeAttempts in
  // authService; this stops one host hammering many emails.
  rateLimit: ({ req }) => [
    { key: `verify:ip:${resolveClientIp(req)}`, ...RATE_LIMITS.verify },
  ],
  handler: async ({ body }) => {
    const result = await authService.verifyLoginCode(body.email, body.code);
    if (result.error || !result.token) {
      return NextResponse.json(
        { error: result.error ?? 'Verification failed' },
        { status: 400 },
      );
    }
    const response = NextResponse.json({ token: result.token });
    setSessionCookie(response, result.token);
    return response;
  },
});
