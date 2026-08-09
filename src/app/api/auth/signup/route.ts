import { NextRequest, NextResponse } from 'next/server';
import { signupSchema } from '@/shared/schemas/auth';
import authService from '@/server/services/authService';
import { handleAuthRoute } from '@/server/auth/routeUtils';

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleAuthRoute(req, async () => {
    const body = signupSchema.parse(await req.json());
    const result = await authService.signupUser(
      body.email,
      body.username,
      body.password,
    );
    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }
    return NextResponse.json({ success: true });
  });
}
