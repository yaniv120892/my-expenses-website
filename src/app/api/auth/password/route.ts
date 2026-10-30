import { NextResponse } from 'next/server';
import { createHandler } from '@/server/http/handler';
import { changePasswordSchema } from '@/shared/schemas/auth';
import authService from '@/server/services/authService';
import { setSessionCookie } from '@/server/auth/cookies';
import { RATE_LIMITS } from '@/server/http/rateLimit';

// Every session ends with the old password, so the caller's own is replaced
// with a fresh one rather than signing them out too.
export const PUT = createHandler({
  auth: 'session',
  bodySchema: changePasswordSchema,
  rateLimit: ({ userId }) => [
    { key: `changePassword:user:${userId}`, ...RATE_LIMITS.changePassword },
  ],
  handler: async ({ userId, body }) => {
    const result = await authService.changePassword({
      userId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    const response = NextResponse.json({ success: true });
    setSessionCookie(response, result.token);
    return response;
  },
});
