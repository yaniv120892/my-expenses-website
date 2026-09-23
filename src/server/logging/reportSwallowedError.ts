import * as Sentry from '@sentry/nextjs';
import logger from '@/server/logging/logger';

type ErrorFields = { err: unknown } & Record<string, unknown>;

/**
 * For a path that catches its error and returns a fallback: neither
 * createHandler nor onRequestError sees it, so the Sentry issue is what keeps
 * it visible past Better Stack's retention.
 */
export function reportSwallowedError(
  fields: ErrorFields,
  message: string,
): void {
  logger.error(fields, message);
  Sentry.captureException(fields.err, { tags: { swallowedAt: message } });
}
