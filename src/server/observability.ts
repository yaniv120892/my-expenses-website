import { createNextObservability } from '@yaniv120892/observability/next';
import { incrementWithTtl } from '@/server/redis';

export const observability = createNextObservability({
  service: 'my-expenses-website',
  alertCounter: ({ key, windowSeconds }) => incrementWithTtl(key, windowSeconds),
  // Added to the package's default tag keys, so a failed import and its extraction request
  // can be found by id. Other ids, such as userId, stay out of the tags on purpose.
  sentryTagKeys: ['importId', 'requestId'],
});

export const { logger } = observability;
