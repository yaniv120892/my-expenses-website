export const NEXT_PATH_PARAM = 'next';

/**
 * Where to go after signing in, taken from a query string an attacker can
 * write: only a path on this site, never `//host` or a scheme, or the login
 * form becomes an open redirect.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return null;
  }
  return value;
}

/** Appends the post-login destination to an auth page's URL, when there is one. */
export function withNextPath({ path, next }: { path: string; next: string | null }): string {
  if (!next) {
    return path;
  }
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${NEXT_PATH_PARAM}=${encodeURIComponent(next)}`;
}
