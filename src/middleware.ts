import { NextRequest, NextResponse } from 'next/server';
import {
  InvalidTokenError,
  TokenExpiredError,
  verifyToken,
} from '@/server/auth/tokens';
import { SESSION_COOKIE } from '@/server/auth/cookies';

const AUTH_PAGES = ['/login', '/signup', '/verify'];

// Signature/expiry check only — the full Redis session check runs in every
// API handler, keeping Redis off the page navigation hot path. A missing
// JWT_SECRET throws (loud misconfiguration) instead of redirect-looping.
async function hasValidToken(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return false;
  }
  try {
    await verifyToken(token);
    return true;
  } catch (err) {
    if (err instanceof TokenExpiredError || err instanceof InvalidTokenError) {
      return false;
    }
    throw err;
  }
}

function isCrossOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) {
    return false;
  }
  const host = req.headers.get('host');
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  // CSRF defense-in-depth on top of SameSite=Lax cookies.
  if (pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && isCrossOrigin(req)) {
      return NextResponse.json(
        { error: 'Cross-origin request rejected' },
        { status: 403 },
      );
    }
    return NextResponse.next();
  }

  const authenticated = await hasValidToken(req);
  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));

  if (!authenticated && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (authenticated && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
