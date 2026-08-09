import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@/shared/schemas/auth';
import authService from '@/server/services/authService';
import { handleAuthRoute } from '@/server/auth/routeUtils';
import { setSessionCookie } from '@/server/auth/cookies';

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleAuthRoute(req, async () => {
    const body = loginSchema.parse(await req.json());
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
  });
}
