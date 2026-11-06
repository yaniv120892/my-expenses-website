import type { T } from '@/i18n/useT.types';
import { AuthRequestError } from '@/services/authClient';

const TOO_MANY_REQUESTS = 429;
const SERVICE_UNAVAILABLE = 503;

/** The server's own message where it sent one; rate limiting and unsendable mail read in the user's language. */
export function authErrorMessage({
  error,
  fallback,
  t,
}: {
  error: unknown;
  fallback: string;
  t: T;
}): string {
  if (!(error instanceof AuthRequestError)) {
    return fallback;
  }
  if (error.status === TOO_MANY_REQUESTS) {
    return t('auth.error.rateLimited');
  }
  if (error.status === SERVICE_UNAVAILABLE) {
    return t('auth.error.emailUnavailable');
  }
  return error.serverMessage || fallback;
}
