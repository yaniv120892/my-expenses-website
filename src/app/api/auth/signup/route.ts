import { NextResponse } from 'next/server';
import { createHandler } from '@/server/http/handler';
import { signupSchema } from '@/shared/schemas/auth';
import authService from '@/server/services/authService';
import { clientIp, enforceRateLimit } from '@/server/http/rateLimit';

export const POST = createHandler({
  auth: 'public',
  bodySchema: signupSchema,
  handler: async ({ req, body }) => {
    // Each signup sends a verification email, so the cap is what keeps the
    // endpoint from being an open SMTP relay.
    await enforceRateLimit(`signup:ip:${clientIp(req)}`, 5, 3600);
    const result = await authService.signupUser(
      body.email,
      body.username,
      body.password,
    );
    if ('error' in result) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }
    return { success: true };
  },
});
