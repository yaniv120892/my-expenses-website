import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIError } from 'openai';
import type * as ObservabilityModule from '@/server/observability';

const { reportError, notifyOpsAlert, incrementWithTtl } = vi.hoisted(() => ({
  reportError: vi.fn(),
  notifyOpsAlert: vi.fn(),
  incrementWithTtl: vi.fn(),
}));

vi.mock('@/server/observability', async (importOriginal) => ({
  ...(await importOriginal<typeof ObservabilityModule>()),
  observability: { reportError, notifyOpsAlert },
}));
vi.mock('@/server/redis', () => ({ incrementWithTtl }));

import { ProviderFallback } from '@/server/services/ai/providerFallback';

const PROVIDER_ERROR = new Error('provider down');
const fallback = new ProviderFallback({ provider: 'Gemini', modelName: () => 'm1' });

beforeEach(() => {
  vi.clearAllMocks();
  incrementWithTtl.mockResolvedValue(1);
});

async function flushScheduledWork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function openAIError(errorBody: { code: string; type: string; message: string }): APIError {
  return APIError.generate(429, { error: errorBody }, undefined, new Headers());
}

const NO_QUOTA_ERROR = openAIError({
  code: 'insufficient_quota',
  type: 'insufficient_quota',
  message: 'You exceeded your current quota, please check your plan and billing details.',
});

describe('ProviderFallback.orFallback', () => {
  it('returns the result and reports nothing when the attempt succeeds', async () => {
    await expect(
      fallback.orFallback({
        operation: 'generateContent',
        attempt: Promise.resolve('answer'),
        fallback: '',
      }),
    ).resolves.toBe('answer');
    expect(reportError).not.toHaveBeenCalled();
  });

  it('reports a failure under the bound label with the per-call operation', async () => {
    await expect(
      fallback.orFallback({
        operation: 'findMatchingTransaction',
        attempt: Promise.reject(PROVIDER_ERROR),
        fallback: null,
      }),
    ).resolves.toBeNull();
    expect(reportError).toHaveBeenCalledWith({
      error: PROVIDER_ERROR,
      where: 'Gemini API error',
      context: { model: 'm1', operation: 'findMatchingTransaction' },
    });
  });

  it('reads the model when the failure is reported, not when it is built', async () => {
    let model = 'model-at-construction';
    const lateModel = new ProviderFallback({ provider: 'Gemini', modelName: () => model });
    model = 'model-at-failure';

    await lateModel.orFallback({
      operation: 'analyzeExpenses',
      attempt: Promise.reject(PROVIDER_ERROR),
      fallback: null,
    });

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { model: 'model-at-failure', operation: 'analyzeExpenses' },
      }),
    );
  });
});

describe('ProviderFallback.categoryIdOrNull', () => {
  it('returns the evaluated category id', async () => {
    await expect(
      fallback.categoryIdOrNull({
        operation: 'suggestCategory',
        evaluation: Promise.resolve({
          categoryId: 'cat-food',
          categoryName: 'Food',
          probability: null,
          inputTokens: null,
          outputTokens: null,
        }),
      }),
    ).resolves.toBe('cat-food');
  });

  it('reports a failed evaluation and returns null', async () => {
    await expect(
      fallback.categoryIdOrNull({
        operation: 'suggestCategory',
        evaluation: Promise.reject(PROVIDER_ERROR),
      }),
    ).resolves.toBeNull();
    expect(reportError).toHaveBeenCalledWith({
      error: PROVIDER_ERROR,
      where: 'Gemini API error',
      context: { model: 'm1', operation: 'suggestCategory' },
    });
  });
});

describe('ProviderFallback out-of-credits alert', () => {
  const chatGPT = new ProviderFallback({ provider: 'ChatGPT', modelName: () => 'gpt-test' });

  it('alerts once a provider answers that its quota is spent, and still falls back', async () => {
    await expect(
      chatGPT.orFallback({
        operation: 'analyzeExpenses',
        attempt: Promise.reject(NO_QUOTA_ERROR),
        fallback: null,
      }),
    ).resolves.toBeNull();

    await vi.waitFor(() => expect(notifyOpsAlert).toHaveBeenCalledTimes(1));
    expect(incrementWithTtl).toHaveBeenCalledWith('ai-out-of-credits-alert:ChatGPT', 86_400);
    expect(notifyOpsAlert).toHaveBeenCalledWith({
      alertType: 'ChatGPT out of credits',
      title: 'ChatGPT is out of credits; top up its account',
      error: NO_QUOTA_ERROR,
      context: { model: 'gpt-test', operation: 'analyzeExpenses' },
    });
  });

  it('stays quiet once the alert is claimed for the window', async () => {
    incrementWithTtl.mockResolvedValue(2);

    await chatGPT.orFallback({
      operation: 'analyzeExpenses',
      attempt: Promise.reject(NO_QUOTA_ERROR),
      fallback: null,
    });

    await vi.waitFor(() => expect(incrementWithTtl).toHaveBeenCalledTimes(1));
    await flushScheduledWork();
    expect(notifyOpsAlert).not.toHaveBeenCalled();
  });

  it('alerts anyway when the Redis claim fails', async () => {
    incrementWithTtl.mockRejectedValue(new Error('redis down'));

    await chatGPT.orFallback({
      operation: 'suggestCategory',
      attempt: Promise.reject(NO_QUOTA_ERROR),
      fallback: null,
    });

    await vi.waitFor(() => expect(notifyOpsAlert).toHaveBeenCalledTimes(1));
    expect(reportError).toHaveBeenCalledWith({
      error: new Error('redis down'),
      where: 'AI out-of-credits alert claim failed',
      context: { provider: 'ChatGPT' },
    });
  });

  it('claims nothing for a plain rate limit', async () => {
    await chatGPT.orFallback({
      operation: 'analyzeExpenses',
      attempt: Promise.reject(
        openAIError({ code: 'rate_limit_exceeded', type: 'requests', message: 'Slow down' }),
      ),
      fallback: null,
    });

    await flushScheduledWork();
    expect(incrementWithTtl).not.toHaveBeenCalled();
    expect(notifyOpsAlert).not.toHaveBeenCalled();
  });
});
