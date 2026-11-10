import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SessionModule from '@/server/auth/session';
import type * as NextServerModule from 'next/server';
import type * as RateLimitModule from '@/server/http/rateLimit';
import { NextRequest } from 'next/server';
import { installFakeCounterStore } from '@/test/fakeCounterStore';

const { requireUser, streamChatResponse, enforceRateLimits } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  streamChatResponse: vi.fn(),
  enforceRateLimits: vi.fn(),
}));

vi.mock('@/server/auth/householdActor', async () =>
  (await import('@/test/memberActor')).householdActorWithTestMembers(),
);
vi.mock('@/server/auth/session', async () => ({
  ...(await vi.importActual<typeof SessionModule>('@/server/auth/session')),
  requireUser,
}));
vi.mock('@/server/services/chatService', () => ({ default: { streamChatResponse } }));
vi.mock('@/server/http/rateLimit', async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimitModule>()),
  enforceRateLimits,
}));
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof NextServerModule>('next/server')),
  after: vi.fn(),
}));

import { maxDuration, POST } from './route';
import { CHAT_USER_DAILY_LIMIT } from '@/server/costFences';

const counters = installFakeCounterStore();
const ROUTE_CONTEXT = { params: Promise.resolve(undefined) };

async function* reply(): AsyncIterable<string> {
  yield 'Hi';
}

function sendMessage(): Promise<Response> {
  return POST(
    new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ sender: 'user', text: 'How much on food?' }] }),
    }),
    ROUTE_CONTEXT,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CHAT_ENABLED', '');
  requireUser.mockResolvedValue({ userId: 'user-1', tokenVersion: 0 });
  streamChatResponse.mockImplementation(async () => reply());
});

describe('POST /api/chat budget', () => {
  it('answers up to the per-user daily limit and refuses the next message without a model call', async () => {
    for (let sent = 0; sent < CHAT_USER_DAILY_LIMIT; sent += 1) {
      expect((await sendMessage()).status).toBe(200);
    }
    streamChatResponse.mockClear();

    const refused = await sendMessage();

    expect(refused.status).toBe(429);
    expect(refused.headers.get('retry-after')).toMatch(/^\d+$/);
    await expect(refused.json()).resolves.toMatchObject({ code: 'DAILY_LIMIT_REACHED' });
    expect(streamChatResponse).not.toHaveBeenCalled();
  });

  it('refuses everyone once the global daily budget is spent', async () => {
    vi.stubEnv('CHAT_GLOBAL_DAILY_LIMIT', '1');
    await sendMessage();
    requireUser.mockResolvedValue({ userId: 'user-2', tokenVersion: 0 });

    const refused = await sendMessage();

    expect(refused.status).toBe(503);
    expect(streamChatResponse).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the counter store is down', async () => {
    counters.goDown();

    const refused = await sendMessage();

    expect(refused.status).toBe(503);
    await expect(refused.json()).resolves.toMatchObject({ code: 'TEMPORARILY_UNAVAILABLE' });
    expect(streamChatResponse).not.toHaveBeenCalled();
  });

  it('answers no one while CHAT_ENABLED is false', async () => {
    vi.stubEnv('CHAT_ENABLED', 'false');

    const refused = await sendMessage();

    expect(refused.status).toBe(503);
    expect(streamChatResponse).not.toHaveBeenCalled();
  });

  it('caps the function at a minute', () => {
    expect(maxDuration).toBe(60);
  });
});
