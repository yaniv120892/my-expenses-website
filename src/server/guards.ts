import { createUpstashCounterStore } from '@yaniv120892/app-kit/counter-store';
import type {
  CounterIncrement,
  CounterReading,
  CounterStore,
} from '@yaniv120892/app-kit/counter-store';
import { createDailyBudget } from '@yaniv120892/app-kit/daily-budget';
import { createRateLimiter } from '@yaniv120892/app-kit/rate-limit';
import { lazy } from '@/server/lib/lazy';
import { redisKeyPrefix } from '@/server/redis';
import { optionalEnv } from '@/server/env';
import { logger, observability } from '@/server/observability';

const getUpstashCounterStore = lazy(() =>
  createUpstashCounterStore({ url: optionalEnv('REDIS_URL'), token: optionalEnv('REDIS_TOKEN') }),
);

/** Namespaced like every other key, because previews share production's counter database. */
export const counterStore: CounterStore = { increment: incrementNamespaced };

const guardReporting = { logger, alerts: observability };

export const rateLimiter = createRateLimiter({ store: counterStore, ...guardReporting });

export const dailyBudget = createDailyBudget({ store: counterStore, ...guardReporting });

function incrementNamespaced({ key, ttlSeconds }: CounterIncrement): Promise<CounterReading> {
  return getUpstashCounterStore().increment({ key: `${redisKeyPrefix()}${key}`, ttlSeconds });
}
