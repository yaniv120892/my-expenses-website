import { NextRequest, NextResponse } from 'next/server';
import authService from '@/server/services/authService';
import { handleAuthRoute } from '@/server/auth/routeUtils';
import { clearSessionCookie } from '@/server/auth/cookies';
import { extractToken } from '@/server/auth/session';
import { verifyToken } from '@/server/auth/tokens';

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleAuthRoute(req, async () => {
    const token = extractToken(req);
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    // Invalidate the Redis session even for an expired-but-well-formed token.
    try {
      const { userId } = await verifyToken(token);
      await authService.logoutUser(userId, token);
    } catch {
      // Nothing to invalidate for a token we cannot attribute to a user.
    }

    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  });
}
