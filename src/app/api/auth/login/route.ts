import { NextResponse } from 'next/server';
import { createHandler } from '@/server/http/handler';
import { loginSchema } from '@/shared/schemas/auth';
import authService from '@/server/services/authService';
import { setSessionCookie } from '@/server/auth/cookies';

export const POST = createHandler({
  auth: 'public',
  bodySchema: loginSchema,
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
