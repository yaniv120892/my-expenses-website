import { createHandler } from '@/server/http/handler';
import { passwordResetRequestSchema } from '@/shared/schemas/auth';
import authService from '@/server/services/authService';
import { RATE_LIMITS, resolveClientIp } from '@/server/http/rateLimit';

export const POST = createHandler({
  auth: 'public',
  bodySchema: passwordResetRequestSchema,
  // Each request mails the address, so it gets its own counter or rotating IPs
  // could flood its inbox.
  rateLimit: ({ request, body }) => [
    {
      key: `passwordResetRequest:ip:${resolveClientIp(request)}`,
      ...RATE_LIMITS.passwordResetRequest,
    },
    {
      key: `passwordResetRequest:email:${body.email.toLowerCase()}`,
      ...RATE_LIMITS.passwordResetRequestPerAddress,
    },
  ],
  handler: async ({ body }) => {
    await authService.requestPasswordReset(body.email);
    return { success: true };
  },
});
