import { createNextObservability } from '@yaniv120892/observability/next';
import { incrementWithTtl } from '@/server/redis';

export const observability = createNextObservability({
  service: 'my-expenses-website',
  alertCounter: ({ key, windowSeconds }) => incrementWithTtl(key, windowSeconds),
  // So a failed import and its extraction request can be found by id in Sentry; other ids,
  // such as userId, stay out of the tags on purpose.
  sentryTagKeys: ['importId', 'requestId'],
});

export const { logger } = observability;
