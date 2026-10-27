// A full page load rather than a client-side route change, so no cached query
// from the previous session survives into the next page.
export function hardNavigate(path: string): void {
  window.location.href = new URL(path, window.location.origin).href;
}

export function redirectToSessionExpired(): void {
  hardNavigate('/login?reason=session-expired');
}
