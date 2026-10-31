import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { InvalidTokenError, TokenExpiredError, verifyToken } from '@/server/auth/tokens';
import { SESSION_COOKIE } from '@/server/auth/cookies';

const AUTH_PAGES = ['/login', '/signup', '/verify', '/forgot-password'];
// Open signed in or out: a reset link opened in a browser still holding a
// session must not be redirected away, losing the token in its fragment.
const OPEN_PAGES = ['/reset-password'];

// Signature/expiry check only — the full Redis session check runs in every
// API handler, keeping Redis off the page navigation hot path. A missing
// JWT_SECRET throws (loud misconfiguration) instead of redirect-looping.
async function hasValidToken(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
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

function isCrossOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) {
    return false;
  }
  const host = request.headers.get('host');
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // CSRF defense-in-depth on top of SameSite=Lax cookies.
  if (pathname.startsWith('/api/')) {
    if (request.method !== 'GET' && isCrossOrigin(request)) {
      return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (OPEN_PAGES.some((page) => pathname.startsWith(page))) {
    return NextResponse.next();
  }

  const authenticated = await hasValidToken(request);
  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));

  if (!authenticated && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (authenticated && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
