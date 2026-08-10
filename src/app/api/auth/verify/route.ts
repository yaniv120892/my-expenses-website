import { NextResponse } from 'next/server';
import { createHandler } from '@/server/http/handler';
import { verifyLoginCodeSchema } from '@/shared/schemas/auth';
import authService from '@/server/services/authService';
import { setSessionCookie } from '@/server/auth/cookies';

export const POST = createHandler({
  auth: 'public',
  bodySchema: verifyLoginCodeSchema,
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
