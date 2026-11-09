import { NextResponse } from 'next/server';
import { createHandler } from '@/server/http/handler';
import { passwordResetSchema } from '@/shared/schemas/auth';
import authService from '@/server/services/authService';
import { clearSessionCookie } from '@/server/auth/cookies';
import { RATE_LIMITS, resolveClientIp } from '@/server/http/rateLimit';

export const POST = createHandler({
  auth: 'public',
  bodySchema: passwordResetSchema,
  rateLimit: ({ request }) => [
    { key: `passwordReset:ip:${resolveClientIp(request)}`, ...RATE_LIMITS.passwordReset },
  ],
  handler: async ({ body }) => {
    const result = await authService.resetPassword(body.token, body.password);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  },
});
