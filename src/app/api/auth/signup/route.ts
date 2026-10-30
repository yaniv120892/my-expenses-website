import { NextResponse } from 'next/server';
import { createHandler } from '@/server/http/handler';
import { signupSchema } from '@/shared/schemas/auth';
import authService from '@/server/services/authService';
import { RATE_LIMITS, resolveClientIp } from '@/server/http/rateLimit';

export const POST = createHandler({
  auth: 'public',
  bodySchema: signupSchema,
  // Every signup for a pending address mails it a code, so the address gets
  // its own counter or rotating IPs could flood its inbox.
  rateLimit: ({ request, body }) => [
    { key: `signup:ip:${resolveClientIp(request)}`, ...RATE_LIMITS.signup },
    {
      key: `signup:email:${body.email.toLowerCase()}`,
      ...RATE_LIMITS.signupPerAddress,
    },
  ],
  handler: async ({ body }) => {
    const result = await authService.signupUser(body.email, body.username);
    if ('error' in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return { success: true };
  },
});
