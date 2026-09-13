import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { reportSwallowedError } = vi.hoisted(() => ({
  reportSwallowedError: vi.fn(),
}));

vi.mock('@/server/logging/reportSwallowedError', () => ({
  reportSwallowedError,
}));

import { GeminiService } from '@/server/services/ai/geminiService';
import { AI_REQUEST_LIMITS } from '@/server/services/ai/requestLimits';
import type { Category } from '@/shared/types/category';
import { stalledFetch } from '@/test/stalledFetch';

const categories: Category[] = [{ id: 'cat-food', name: 'Food' }];

const hangingFetch = vi.fn(stalledFetch);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GEMINI_API_KEY = 'test-key';
  vi.stubGlobal('fetch', hangingFetch);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('GeminiService against a stalled provider', () => {
  it('fails the one call at the timeout instead of hanging', async () => {
    let settled = false;
    const pending = new GeminiService()
      .suggestCategory('coffee', categories)
      .finally(() => {
        settled = true;
      });

    await vi.advanceTimersByTimeAsync(AI_REQUEST_LIMITS.timeoutMs - 1);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    expect(settled).toBe(true);
    await expect(pending).resolves.toBeNull();
    expect(hangingFetch).toHaveBeenCalledTimes(1);
    expect(reportSwallowedError).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Gemini API error',
    );
  });
});
