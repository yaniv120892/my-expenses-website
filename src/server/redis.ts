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

export async function setValue(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  await getClient().set(key, value, { ex: ttlSeconds });
}

export async function getValue<T = unknown>(key: string): Promise<T | null> {
  return getClient().get<T>(key);
}

export async function deleteValue(key: string): Promise<void> {
  await getClient().del(key);
}

export async function incrementWithTtl(
  key: string,
  ttlSeconds: number,
): Promise<number> {
  const client = getClient();
  const count = await client.incr(key);
  if (count === 1) {
    await expireOrDiscard(client, [{ key, ttlSeconds }]);
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
    incrementPipeline.incr(increment.key);
  }
  const counts = await incrementPipeline.exec<number[]>();
  const firstHits = increments.filter((_, index) => counts[index] === 1);
  if (firstHits.length > 0) {
    await expireOrDiscard(client, firstHits);
  }
  return counts;
}
