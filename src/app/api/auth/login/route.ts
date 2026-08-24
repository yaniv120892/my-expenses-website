import { NextResponse } from 'next/server';
import { createHandler } from '@/server/http/handler';
import { loginSchema } from '@/shared/schemas/auth';
import authService from '@/server/services/authService';
import { setSessionCookie } from '@/server/auth/cookies';
import { RATE_LIMITS, resolveClientIp } from '@/server/http/rateLimit';

export const POST = createHandler({
  auth: 'public',
  bodySchema: loginSchema,
  // Both keys: per-IP stops one host spraying many accounts, per-email
  // (case-folded) stops a distributed guess against one account.
  rateLimit: ({ req, body }) => [
    { key: `login:ip:${resolveClientIp(req)}`, ...RATE_LIMITS.login },
    { key: `login:email:${body.email.toLowerCase()}`, ...RATE_LIMITS.login },
  ],
  handler: async ({ body }) => {
    const result = await authService.loginUser(
      body.email,
      body.username,
      body.password,
    );
    if (result.error || !result.token) {
      return NextResponse.json(
        { success: false, error: result.error ?? 'Login failed' },
        { status: 400 },
      );
    }
    const response = NextResponse.json({ success: true, token: result.token });
    setSessionCookie(response, result.token);
    return response;
  },
});
