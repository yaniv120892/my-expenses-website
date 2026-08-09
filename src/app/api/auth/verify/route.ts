import { NextRequest, NextResponse } from 'next/server';
import { verifyLoginCodeSchema } from '@/shared/schemas/auth';
import authService from '@/server/services/authService';
import { handleAuthRoute } from '@/server/auth/routeUtils';
import { setSessionCookie } from '@/server/auth/cookies';

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleAuthRoute(req, async () => {
    const body = verifyLoginCodeSchema.parse(await req.json());
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
  });
}
