import { NextResponse } from 'next/server';
import { createHandler } from '@/server/http/handler';
import authService from '@/server/services/authService';
import { clearSessionCookie } from '@/server/auth/cookies';
import { AuthError, extractToken } from '@/server/auth/session';
import { verifyToken } from '@/server/auth/tokens';

// auth: 'public' because logout must also accept an expired-but-well-formed
// token — the Redis session still gets invalidated.
export const POST = createHandler({
  auth: 'public',
  handler: async ({ req }) => {
    const token = extractToken(req);
    if (!token) {
      throw new AuthError('AUTH_REQUIRED', 'Authentication required');
    }

    try {
      const { userId } = await verifyToken(token);
      await authService.logoutUser(userId, token);
    } catch {
      // Nothing to invalidate for a token we cannot attribute to a user.
    }

    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  },
});
