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

// Preview deployments share production's Upstash database — the free tier
// allows exactly one — so every key is namespaced. Only production is bare,
// because prefixing it would orphan every session and cache entry already
// stored under the current names; anything else, an unconfigured local process
// included, is namespaced so it can never write into production's keyspace.
//
// 'build' isolates a preview's caches per commit, so a value cached by a buggy
// commit is not still served after the fix is pushed. 'branch' is for anything
// a person holds across a push — a session, a login code — which keying per
// commit would invalidate mid-use.
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
