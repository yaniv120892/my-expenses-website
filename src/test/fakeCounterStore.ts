import { vi } from 'vitest';
import { z } from 'zod';

const counterCommandsSchema = z.tuple([
  z.tuple([z.literal('INCR'), z.string()]),
  z.tuple([z.literal('EXPIRE'), z.string(), z.string()]),
]);

export const FAKE_COUNTER_STORE_ENV = {
  REDIS_URL: 'https://counters.test',
  REDIS_TOKEN: 'test-token',
} as const;

export type FakeCounterStore = ReturnType<typeof createFakeCounterStore>;

/**
 * Answers the counter store's REST `multi-exec` calls from memory, so a spec runs the real guards
 * end to end. Stub it as the global `fetch` and set `FAKE_COUNTER_STORE_ENV` before the first
 * guarded call: the store keeps the `fetch` it was built with.
 */
export function createFakeCounterStore() {
  const counts = new Map<string, number>();
  const state = { isDown: false };

  const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (state.isDown) {
      return new Response('unavailable', { status: 503 });
    }
    const [[, key]] = counterCommandsSchema.parse(JSON.parse(String(init?.body)));
    const hits = (counts.get(key) ?? 0) + 1;
    counts.set(key, hits);
    return Response.json([{ result: hits }, { result: 1 }]);
  });

  return {
    fetch,
    keys: () => [...counts.keys()],
    goDown: () => {
      state.isDown = true;
    },
    reset: () => {
      counts.clear();
      state.isDown = false;
    },
  };
}
