export const NEXT_PATH_PARAM = 'next';

const PLACEHOLDER_ORIGIN = 'https://next-path.invalid';

const LAST_C0_CONTROL_CODE = 0x1f;
const DELETE_CODE = 0x7f;

/**
 * Where to go after signing in, taken from a query string an attacker can
 * write: only a path on this site, or the login form becomes an open redirect.
 * The value is resolved the way a browser would and must stay on the same
 * origin.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  const isPlainSitePath = !!value && value.startsWith('/') && !hasControlCharacter(value);
  if (!isPlainSitePath) {
    return null;
  }
  let resolved: URL;
  try {
    resolved = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }
  if (resolved.origin !== PLACEHOLDER_ORIGIN) {
    return null;
  }
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

/** Appends the post-login destination to an auth page's URL, when there is one. */
export function withNextPath({ path, next }: { path: string; next: string | null }): string {
  if (!next) {
    return path;
  }
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${NEXT_PATH_PARAM}=${encodeURIComponent(next)}`;
}

// A browser strips tabs and newlines from a URL before resolving it, so
// `/\t/evil.example` reaches the address bar as `//evil.example`.
function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= LAST_C0_CONTROL_CODE || code === DELETE_CODE) {
      return true;
    }
  }
  return false;
}
