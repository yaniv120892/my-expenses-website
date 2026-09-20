import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  evaluate,
  reportSwallowedError,
  createGateway,
  createTypeSafeAi,
  evaluationModel,
} = vi.hoisted(() => ({
  evaluate: vi.fn(),
  reportSwallowedError: vi.fn(),
  createGateway: vi.fn(),
  createTypeSafeAi: vi.fn(),
  evaluationModel: vi.fn(),
}));

vi.mock('ai', () => ({ experimental_evaluate: evaluate }));
vi.mock('@ai-sdk/gateway', () => ({ createGateway }));
vi.mock('@ai-sdk/typesafe-ai', () => ({ createTypeSafeAi }));
vi.mock('@/server/logging/reportSwallowedError', () => ({
  reportSwallowedError,
}));

import { JevCategorySuggester } from '@/server/services/ai/jevCategorySuggester';
import { AI_REQUEST_LIMITS } from '@/server/services/ai/requestLimits';
import type { Category } from '@/shared/types/category';

const categories: Category[] = [
  { id: 'cat-food', name: 'Food & Drinks', parentId: null },
  { id: 'cat-eating-out', name: 'Eating out', parentId: 'cat-food' },
  { id: 'cat-taxi', name: 'Taxi', parentId: 'cat-transport' },
];

function jevAnswer(choice: string, probability: number) {
  return {
    answers: {
      category: {
        type: 'choice',
        choice,
        probabilities: { [choice]: probability },
      },
    },
    usage: { inputTokens: 321, outputTokens: 0, totalTokens: 321 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('AI_GATEWAY_API_KEY', 'test-gateway-key');
  vi.stubEnv('TYPESAFE_API_KEY', '');
  vi.stubEnv('JEV_MODEL', '');
  evaluationModel.mockReturnValue({ modelId: 'typesafe-ai/jev' });
  createGateway.mockReturnValue({ evaluationModel });
  createTypeSafeAi.mockReturnValue({ evaluationModel });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('JevCategorySuggester', () => {
  it('maps the chosen category name back to its id', async () => {
    evaluate.mockResolvedValue(jevAnswer('Eating out', 0.91));

    const categoryId = await new JevCategorySuggester().suggestCategory(
      'ארומה תל אביב',
      categories,
    );

    expect(categoryId).toBe('cat-eating-out');
  });

  it('offers every category by the bare name the LLM prompt lists, with no description', async () => {
    evaluate.mockResolvedValue(jevAnswer('Taxi', 0.7));

    await new JevCategorySuggester().suggestCategory('GETT', categories);

    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        questions: {
          category: expect.objectContaining({
            type: 'choice',
            criteria: { 'Food & Drinks': null, 'Eating out': null, Taxi: null },
          }),
        },
      }),
    );
  });

  it('bounds the call by the shared request limits', async () => {
    evaluate.mockResolvedValue(jevAnswer('Taxi', 0.7));

    await new JevCategorySuggester().suggestCategory('GETT', categories);

    const [options] = evaluate.mock.calls[0];
    expect(options.maxRetries).toBe(AI_REQUEST_LIMITS.maxRetries);
    expect(options.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it('exposes probability and token usage for benchmarks', async () => {
    evaluate.mockResolvedValue(jevAnswer('Taxi', 0.7));

    const evaluation = await new JevCategorySuggester().evaluateCategory(
      'GETT',
      categories,
    );

    expect(evaluation).toEqual({
      categoryId: 'cat-taxi',
      categoryName: 'Taxi',
      probability: 0.7,
      inputTokens: 321,
      outputTokens: 0,
    });
  });

  it('returns null and reports the error when the provider fails', async () => {
    evaluate.mockRejectedValue(new Error('gateway 503'));

    const categoryId = await new JevCategorySuggester().suggestCategory(
      'GETT',
      categories,
    );

    expect(categoryId).toBeNull();
    expect(reportSwallowedError).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Jev API error',
    );
  });

  it('calls the gateway model by its gateway id when only that key is set', async () => {
    evaluate.mockResolvedValue(jevAnswer('Taxi', 0.7));

    await new JevCategorySuggester().suggestCategory('GETT', categories);

    expect(createGateway).toHaveBeenCalledWith({ apiKey: 'test-gateway-key' });
    expect(createTypeSafeAi).not.toHaveBeenCalled();
    expect(evaluationModel).toHaveBeenCalledWith('typesafe-ai/jev');
  });

  it("prefers a direct TypeSafe key, with that route's model id", async () => {
    vi.stubEnv('TYPESAFE_API_KEY', 'test-typesafe-key');
    evaluate.mockResolvedValue(jevAnswer('Taxi', 0.7));

    await new JevCategorySuggester().suggestCategory('GETT', categories);

    expect(createTypeSafeAi).toHaveBeenCalledWith({
      apiKey: 'test-typesafe-key',
    });
    expect(createGateway).not.toHaveBeenCalled();
    expect(evaluationModel).toHaveBeenCalledWith('jev-latest');
  });

  it('does not read the gateway key until a call is made', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');

    const suggester = new JevCategorySuggester();
    expect(createGateway).not.toHaveBeenCalled();

    const categoryId = await suggester.suggestCategory('GETT', categories);

    expect(categoryId).toBeNull();
    expect(reportSwallowedError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.objectContaining({
          message: expect.stringContaining('AI_GATEWAY_API_KEY'),
        }),
      }),
      'Jev API error',
    );
  });
});
