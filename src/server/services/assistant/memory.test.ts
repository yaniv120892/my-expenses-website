import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { constructStore } = vi.hoisted(() => ({ constructStore: vi.fn() }));

vi.mock('@mastra/pg', () => ({
  PostgresStore: class {
    constructor(options: unknown) {
      constructStore(options);
    }
  },
}));
vi.mock('@mastra/memory', () => ({ Memory: class {} }));

const DIRECT_URL = 'postgresql://user:pass@ep-x.neon.tech/neondb';

beforeEach(() => {
  vi.resetModules();
  constructStore.mockClear();
  vi.stubEnv('MASTRA_DB_URL', '');
  vi.stubEnv('DIRECT_URL', `${DIRECT_URL}?sslmode=require`);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getAssistantMemory', () => {
  it('hands its store the URL with sslmode pinned to verify-full', async () => {
    const { getAssistantMemory } =
      await import('@/server/services/assistant/memory');

    expect(getAssistantMemory()).toBeDefined();
    expect(constructStore).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: `${DIRECT_URL}?sslmode=verify-full`,
      }),
    );
  });
});
