import { createNextObservability } from '@yaniv120892/observability/next';
import { incrementWithTtl } from '@/server/redis';

export const observability = createNextObservability({
  service: 'my-expenses-website',
  alertCounter: ({ key, windowSeconds }) => incrementWithTtl(key, windowSeconds),
});

export const { logger } = observability;
