import type { T } from '@/i18n/useT';
import { AuthRequestError } from '@/services/authClient';

const TOO_MANY_REQUESTS = 429;

/** The server's own message where it sent one; rate limiting reads in the user's language. */
export function authErrorMessage({
  error,
  fallback,
  t,
}: {
  error: unknown;
  fallback: string;
  t: T;
}): string {
  if (error instanceof AuthRequestError && error.status === TOO_MANY_REQUESTS) {
    return t('auth.error.rateLimited');
  }
  if (error instanceof AuthRequestError && error.serverMessage) {
    return error.serverMessage;
  }
  return fallback;
}
