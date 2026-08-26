import * as Sentry from '@sentry/nextjs';
import logger from '@/server/logging/logger';

type ErrorFields = { err: unknown } & Record<string, unknown>;

/**
 * For a path that catches its error and returns a fallback instead of
 * rethrowing. Nothing downstream sees such an error: `createHandler` only
 * reports what reaches its 5xx branch, and `onRequestError` only what escapes
 * the route. Logging alone leaves it visible for Better Stack's three days and
 * then nowhere, so the Sentry issue is what makes it countable and alertable.
 */
export function reportSwallowedError(
  fields: ErrorFields,
  message: string,
): void {
  logger.error(fields, message);
  Sentry.captureException(fields.err, { tags: { swallowedAt: message } });
}
