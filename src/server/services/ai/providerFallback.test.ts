import { describe, it, expect, vi, beforeEach } from 'vitest';
import type * as ObservabilityModule from '@/server/observability';

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }));

vi.mock('@/server/observability', async (importOriginal) => ({
  ...(await importOriginal<typeof ObservabilityModule>()),
  observability: { reportError },
}));

import { ProviderFallback } from '@/server/services/ai/providerFallback';

const PROVIDER_ERROR = new Error('provider down');
const fallback = new ProviderFallback({ where: 'Test API error', modelName: () => 'm1' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProviderFallback.orFallback', () => {
  it('returns the result and reports nothing when the attempt succeeds', async () => {
    await expect(
      fallback.orFallback({ attempt: Promise.resolve('answer'), fallback: '' }),
    ).resolves.toBe('answer');
    expect(reportError).not.toHaveBeenCalled();
  });

  it('reports a failure under the bound label and returns the fallback', async () => {
    await expect(
      fallback.orFallback({ attempt: Promise.reject(PROVIDER_ERROR), fallback: null }),
    ).resolves.toBeNull();
    expect(reportError).toHaveBeenCalledWith({
      error: PROVIDER_ERROR,
      where: 'Test API error',
      context: { model: 'm1' },
    });
  });

  it('reads the model when the failure is reported, not when it is built', async () => {
    let model = 'model-at-construction';
    const lateModel = new ProviderFallback({ where: 'Test API error', modelName: () => model });
    model = 'model-at-failure';

    await lateModel.orFallback({ attempt: Promise.reject(PROVIDER_ERROR), fallback: null });

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ context: { model: 'model-at-failure' } }),
    );
  });
});

describe('ProviderFallback.categoryIdOrNull', () => {
  it('returns the evaluated category id', async () => {
    await expect(
      fallback.categoryIdOrNull(
        Promise.resolve({
          categoryId: 'cat-food',
          categoryName: 'Food',
          probability: null,
          inputTokens: null,
          outputTokens: null,
        }),
      ),
    ).resolves.toBe('cat-food');
  });

  it('reports a failed evaluation and returns null', async () => {
    await expect(fallback.categoryIdOrNull(Promise.reject(PROVIDER_ERROR))).resolves.toBeNull();
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ error: PROVIDER_ERROR, where: 'Test API error' }),
    );
  });
});
