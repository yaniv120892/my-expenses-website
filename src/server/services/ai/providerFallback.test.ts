import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as ObservabilityModule from '@/server/observability';

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));

vi.mock('@/server/observability', async (importOriginal) => ({
  ...(await importOriginal<typeof ObservabilityModule>()),
  observability: { reportError },
}));

import { ProviderFallback } from '@/server/services/ai/providerFallback';

const PROVIDER_ERROR = new Error('provider down');
const fallback = new ProviderFallback({ provider: 'Gemini', modelName: () => 'm1' });

beforeEach(() => {
  vi.clearAllMocks();
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
