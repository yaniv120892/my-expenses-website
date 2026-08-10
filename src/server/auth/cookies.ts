import { NextResponse } from 'next/server';
import { tokenTtlSeconds } from '@/server/auth/tokens';

export const SESSION_COOKIE = 'session';

// Shared by set and clear — a drifting attribute (e.g. path) would make
// clearing silently fail.
const SESSION_COOKIE_ATTRS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
} as const;

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE, token, {
    ...SESSION_COOKIE_ATTRS,
    maxAge: tokenTtlSeconds(),
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, '', { ...SESSION_COOKIE_ATTRS, maxAge: 0 });
}
