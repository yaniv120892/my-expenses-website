import { beforeAll, beforeEach, vi } from 'vitest';
import { z } from 'zod';

const counterCommandsSchema = z.tuple([
  z.tuple([z.literal('INCR'), z.string()]),
  z.tuple([z.literal('EXPIRE'), z.string(), z.string()]),
]);

const FAKE_COUNTER_STORE_ENV = {
  REDIS_URL: 'https://counters.test',
  REDIS_TOKEN: 'test-token',
} as const;

export type FakeCounterStore = ReturnType<typeof createFakeCounterStore>;

/**
 * Points the spec's guards at an in-memory counter store, emptied before each test. Call it at the
 * top level of the spec: the store keeps the `fetch` and env it was built with on first use.
 */
export function installFakeCounterStore(): FakeCounterStore {
  const counters = createFakeCounterStore();
  beforeAll(() => {
    vi.stubGlobal('fetch', counters.fetch);
    for (const [name, value] of Object.entries(FAKE_COUNTER_STORE_ENV)) {
      vi.stubEnv(name, value);
    }
  });
  beforeEach(() => {
    counters.reset();
  });
  return counters;
}

function createFakeCounterStore() {
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

  function keys(): string[] {
    return [...counts.keys()];
  }

  function goDown(): void {
    state.isDown = true;
  }

  function reset(): void {
    counts.clear();
    state.isDown = false;
  }

  return { fetch, keys, goDown, reset };
}
