import { NextResponse } from 'next/server';
import { createHandler } from '@/server/http/handler';
import { loginSchema } from '@/shared/schemas/auth';
import authService from '@/server/services/authService';
import { setSessionCookie } from '@/server/auth/cookies';
import { clientIp, enforceRateLimit } from '@/server/http/rateLimit';

export const POST = createHandler({
  auth: 'public',
  bodySchema: loginSchema,
  handler: async ({ req, body }) => {
    // Both keys: per-IP stops one host spraying many accounts, per-email
    // stops a distributed guess against one account.
    await Promise.all([
      enforceRateLimit(`login:ip:${clientIp(req)}`, 10, 900),
      enforceRateLimit(`login:email:${body.email}`, 10, 900),
    ]);
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
