import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ClientOptions } from 'openai';

const { reportSwallowedError, hangingFetch, constructedWith } = vi.hoisted(
  () => ({
    reportSwallowedError: vi.fn(),
    constructedWith: [] as unknown[],
    // Never answers; rejects only when the SDK aborts it, as a real stalled
    // socket would.
    hangingFetch: vi.fn(
      (_url: unknown, init?: { signal?: AbortSignal | null }) =>
        new Promise<never>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const abortError = new Error('The operation was aborted');
            abortError.name = 'AbortError';
            reject(abortError);
          });
        }),
    ),
  }),
);

vi.mock('openai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('openai')>();
  class RecordingOpenAI extends actual.default {
    constructor(options: ClientOptions) {
      constructedWith.push(options);
      super({ ...options, fetch: hangingFetch });
    }
  }
  return { ...actual, default: RecordingOpenAI };
});
vi.mock('@/server/logging/reportSwallowedError', () => ({
  reportSwallowedError,
}));

import { APIConnectionTimeoutError } from 'openai';
import { ChatGPTService } from '@/server/services/ai/chatGPTService';
import { AI_REQUEST_LIMITS } from '@/server/services/ai/requestLimits';
import type { Category } from '@/shared/types/category';

const categories: Category[] = [{ id: 'cat-food', name: 'Food' }];

beforeEach(() => {
  vi.clearAllMocks();
  constructedWith.length = 0;
  process.env.OPENAI_API_KEY = 'test-key';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ChatGPTService request limits', () => {
  it('builds the client with the shared timeout and retry count', async () => {
    const pending = new ChatGPTService().suggestCategory('coffee', categories);
    await vi.runAllTimersAsync();
    await pending;

    expect(constructedWith).toEqual([
      expect.objectContaining({ timeout: 30_000, maxRetries: 1 }),
    ]);
    expect(AI_REQUEST_LIMITS).toEqual({ timeoutMs: 30_000, maxRetries: 1 });
  });

  it('does not build the client until a call is made', () => {
    new ChatGPTService();

    expect(constructedWith).toHaveLength(0);
  });

  it('fails a stalled call after the timeout and one retry instead of hanging', async () => {
    let settled = false;
    const pending = new ChatGPTService()
      .suggestCategory('coffee', categories)
      .finally(() => {
        settled = true;
      });

    await vi.advanceTimersByTimeAsync(AI_REQUEST_LIMITS.timeoutMs - 1);
    expect(settled).toBe(false);

    // Second attempt's timeout plus the SDK's retry backoff (under a second
    // for the first retry).
    await vi.advanceTimersByTimeAsync(AI_REQUEST_LIMITS.timeoutMs + 2_000);

    expect(settled).toBe(true);
    await expect(pending).resolves.toBeNull();
    expect(hangingFetch).toHaveBeenCalledTimes(2);
    expect(reportSwallowedError).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(APIConnectionTimeoutError) }),
      'ChatGPT API error',
    );
  });
});
