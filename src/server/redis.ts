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
    await client.expire(key, ttlSeconds);
  }
  return count;
}
