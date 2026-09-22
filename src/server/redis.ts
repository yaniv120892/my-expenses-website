import { Redis } from '@upstash/redis';
import { lazy } from '@/server/lib/lazy';
import { requireEnv } from '@/server/env';

const getClient = lazy(
  () =>
    new Redis({
      url: requireEnv('REDIS_URL'),
      token: requireEnv('REDIS_TOKEN'),
    }),
);

export type KeyScope = 'build' | 'branch';

export function redisKeyPrefix(scope: KeyScope = 'build'): string {
  const environment = process.env.VERCEL_ENV;
  if (environment === 'production') {
    return '';
  }
  if (!environment) {
    return 'local:';
  }
  return `${environment}:${discriminator(scope, environment)}:`;
}

export async function setValue(
  key: string,
  value: unknown,
  ttlSeconds: number,
  scope: KeyScope = 'build',
): Promise<void> {
  await getClient().set(namespacedKey(key, scope), value, { ex: ttlSeconds });
}

export async function getValue<T = unknown>(
  key: string,
  scope: KeyScope = 'build',
): Promise<T | null> {
  return getClient().get<T>(namespacedKey(key, scope));
}

export async function deleteValue(
  key: string,
  scope: KeyScope = 'build',
): Promise<void> {
  await getClient().del(namespacedKey(key, scope));
}

export async function incrementWithTtl(
  key: string,
  ttlSeconds: number,
  scope: KeyScope = 'build',
): Promise<number> {
  const client = getClient();
  const namespaced = namespacedKey(key, scope);
  const count = await client.incr(namespaced);
  if (count === 1) {
    await expireOrDiscard(client, [{ key: namespaced, ttlSeconds }]);
  }
  return count;
}

// A counter whose EXPIRE failed would never reset, so the key is discarded and
// its window restarts.
async function expireOrDiscard(
  client: Redis,
  entries: { key: string; ttlSeconds: number }[],
): Promise<void> {
  try {
    const pipeline = client.pipeline();
    for (const entry of entries) {
      pipeline.expire(entry.key, entry.ttlSeconds);
    }
    await pipeline.exec();
  } catch (error) {
    await discardCounters(client, entries);
    throw error;
  }
}

async function discardCounters(
  client: Redis,
  entries: { key: string }[],
): Promise<void> {
  await Promise.allSettled(entries.map((entry) => client.del(entry.key)));
}

type CounterIncrement = { key: string; ttlSeconds: number };

// EXPIRE goes out only on a counter's first hit, keeping steady-state cost at
// one command per counter.
export async function incrementManyWithTtl(
  increments: CounterIncrement[],
): Promise<number[]> {
  if (increments.length === 0) {
    return [];
  }
  const client = getClient();
  if (increments.length === 1) {
    const only = increments[0];
    return [await incrementWithTtl(only.key, only.ttlSeconds)];
  }
  const prefix = redisKeyPrefix();
  const namespacedIncrements = increments.map((increment) => ({
    ...increment,
    key: `${prefix}${increment.key}`,
  }));
  const incrementPipeline = client.pipeline();
  for (const increment of namespacedIncrements) {
    incrementPipeline.incr(increment.key);
  }
  const counts = await incrementPipeline.exec<number[]>();
  // Missing counts are never === 1, so those counters would get no TTL and never
  // reset; discard them and fail loudly instead.
  if (counts.length !== namespacedIncrements.length) {
    await discardCounters(client, namespacedIncrements);
    throw new Error(
      `Expected ${namespacedIncrements.length} counters from the Redis pipeline, got ${counts.length} (${namespacedIncrements
        .map((increment) => increment.key)
        .join(', ')})`,
    );
  }
  const firstHits = namespacedIncrements.filter(
    (_, index) => counts[index] === 1,
  );
  if (firstHits.length > 0) {
    await expireOrDiscard(client, firstHits);
  }
  return counts;
}

function discriminator(scope: KeyScope, environment: string): string {
  if (scope === 'branch') {
    return process.env.VERCEL_GIT_COMMIT_REF || environment;
  }
  return (
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    environment
  );
}

function namespacedKey(key: string, scope: KeyScope): string {
  return `${redisKeyPrefix(scope)}${key}`;
}
