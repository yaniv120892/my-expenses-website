import { NextResponse } from 'next/server';
import { createHandler } from '@/server/http/handler';
import { loginSchema } from '@/shared/schemas/auth';
import authService from '@/server/services/authService';
import { setSessionCookie } from '@/server/auth/cookies';
import { RATE_LIMITS, resolveClientIp } from '@/server/http/rateLimit';

export const POST = createHandler({
  auth: 'public',
  bodySchema: loginSchema,
  // The lookup matches either identifier, so each gets its own counter: keyed
  // on the email alone, a fresh email per request beside the victim's
  // username would leave only the per-IP limit.
  rateLimit: ({ req, body }) => [
    { key: `login:ip:${resolveClientIp(req)}`, ...RATE_LIMITS.login },
    { key: `login:email:${body.email.toLowerCase()}`, ...RATE_LIMITS.login },
    {
      key: `login:username:${body.username.toLowerCase()}`,
      ...RATE_LIMITS.login,
    },
  ],
  handler: async ({ body }) => {
    const result = await authService.loginUser(body.email, body.username, body.password);
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
