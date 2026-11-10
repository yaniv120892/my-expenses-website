import { describe, expect, it, vi } from 'vitest';
import { installFakeCounterStore } from '@/test/fakeCounterStore';
import { counterStore } from '@/server/guards';

const counters = installFakeCounterStore();

describe('counterStore', () => {
  it('namespaces a preview count, since previews share the production store', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abcdef1234567890');

    await counterStore.increment({ key: 'chat_budget:global:1', ttlSeconds: 60 });

    expect(counters.keys()).toEqual(['preview:abcdef123456:chat_budget:global:1']);
  });

  it('keeps a production count bare', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');

    await counterStore.increment({ key: 'chat_budget:global:1', ttlSeconds: 60 });

    expect(counters.keys()).toEqual(['chat_budget:global:1']);
  });
});
