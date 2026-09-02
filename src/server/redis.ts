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

// Preview deployments share production's Upstash database, because the free
// tier allows exactly one. Every key is therefore namespaced, and previews
// namespace per commit: a bad commit that caches a wrong value would otherwise
// keep serving it after the fix is pushed, until the TTL lapsed, so the fix
// would look broken. A fresh commit gets a fresh namespace and reads nothing
// the previous one wrote. Every key carries a TTL, so abandoned namespaces
// expire on their own.
// Production stays unprefixed — adding one would orphan every session and
// cache entry already stored under the bare keys.
export function redisKeyPrefix(): string {
  const environment = process.env.VERCEL_ENV;
  if (!environment || environment === 'production') {
    return '';
  }
  const commit =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    environment;
  return `${environment}:${commit}:`;
}

function prefixed(key: string): string {
  return `${redisKeyPrefix()}${key}`;
}

export async function setValue(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  await getClient().set(prefixed(key), value, { ex: ttlSeconds });
}

export async function getValue<T = unknown>(key: string): Promise<T | null> {
  return getClient().get<T>(prefixed(key));
}

export async function deleteValue(key: string): Promise<void> {
  await getClient().del(prefixed(key));
}

export async function incrementWithTtl(
  key: string,
  ttlSeconds: number,
): Promise<number> {
  const client = getClient();
  const namespaced = prefixed(key);
  const count = await client.incr(namespaced);
  if (count === 1) {
    await expireOrDiscard(client, [{ key: namespaced, ttlSeconds }]);
  }
  return count;
}

// A counter whose EXPIRE failed would never reset and lock its key out
// forever, so the key is discarded before the failure propagates — the
// window restarts instead of jamming shut.
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
    await Promise.allSettled(entries.map((entry) => client.del(entry.key)));
    throw error;
  }
}

type CounterIncrement = { key: string; ttlSeconds: number };

// All INCRs ride one pipelined request; EXPIRE goes out only for counters on
// the first hit of their window, keeping steady-state cost at one command
// per counter against the Upstash free-tier budget.
export async function incrementManyWithTtl(
  increments: CounterIncrement[],
): Promise<number[]> {
  const client = getClient();
  if (increments.length === 1) {
    const only = increments[0];
    return [await incrementWithTtl(only.key, only.ttlSeconds)];
  }
  const incrementPipeline = client.pipeline();
  for (const increment of increments) {
    incrementPipeline.incr(prefixed(increment.key));
  }
  const counts = await incrementPipeline.exec<number[]>();
  const firstHits = increments
    .map((increment) => ({ ...increment, key: prefixed(increment.key) }))
    .filter((_, index) => counts[index] === 1);
  if (firstHits.length > 0) {
    await expireOrDiscard(client, firstHits);
  }
  return counts;
}
