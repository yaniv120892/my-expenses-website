import { safeNextPath, withNextPath } from '@/shared/nextPath';

// A full page load rather than a client-side route change, so no cached query
// from the previous session survives into the next page.
export function hardNavigate(path: string): void {
  window.location.href = new URL(path, window.location.origin).href;
}

/** Back here after signing in again, so a link being followed (an invite) is not lost. */
export function redirectToSessionExpired(): void {
  const here = safeNextPath(`${window.location.pathname}${window.location.search}`);
  hardNavigate(withNextPath({ path: '/login?reason=session-expired', next: here }));
}
