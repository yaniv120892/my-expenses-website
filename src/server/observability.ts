import { createNextObservability } from '@yaniv120892/observability/next';
import { incrementWithTtl } from '@/server/redis';

export const observability = createNextObservability({
  service: 'my-expenses-website',
  alertCounter: ({ key, windowSeconds }) => incrementWithTtl(key, windowSeconds),
  // On top of the package's default tag keys, so an import's events can be found by its id.
  sentryTagKeys: ['importId', 'requestId'],
});

export const { logger } = observability;
