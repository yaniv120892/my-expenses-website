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

const categories = [
  { id: 'cat-food', name: 'Food & Drinks' },
  { id: 'cat-eating-out', name: 'Eating out' },
  { id: 'cat-taxi', name: 'Taxi' },
];

function jevAnswer(choice: string, probability: number) {
  return {
    answers: { category: { choice, probabilities: { [choice]: probability } } },
    usage: { inputTokens: 321, outputTokens: 0 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('AI_GATEWAY_API_KEY', 'test-gateway-key');
  vi.stubEnv('TYPESAFE_AI_API_KEY', '');
  vi.stubEnv('JEV_MODEL', '');
  evaluationModel.mockReturnValue({});
  createGateway.mockReturnValue({ evaluationModel });
  createTypeSafeAi.mockReturnValue({ evaluationModel });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
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

  it('passes the shared option list through to the evaluation', async () => {
    evaluate.mockResolvedValue(jevAnswer('Taxi', 0.7));

    await new JevCategorySuggester().suggestCategory('GETT', categories);

    expect(evaluate.mock.calls[0][0].questions.category.criteria).toEqual({
      'Food & Drinks': null,
      'Eating out': null,
      Taxi: null,
    });
  });

  it('bounds the call by the shared request limits', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    evaluate.mockResolvedValue(jevAnswer('Taxi', 0.7));

    await new JevCategorySuggester().suggestCategory('GETT', categories);

    expect(evaluate.mock.calls[0][0].maxRetries).toBe(
      AI_REQUEST_LIMITS.maxRetries,
    );
    expect(timeout).toHaveBeenCalledWith(AI_REQUEST_LIMITS.timeoutMs);
  });

  it('returns the shared record with Jev probability and token usage', async () => {
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

  it('answers nothing without a call when no category is offered', async () => {
    const evaluation = await new JevCategorySuggester().evaluateCategory(
      'GETT',
      [],
    );

    expect(evaluation.categoryId).toBeNull();
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('rejects on provider failure where suggestCategory swallows', async () => {
    evaluate.mockRejectedValue(new Error('gateway 503'));
    const suggester = new JevCategorySuggester();

    await expect(
      suggester.evaluateCategory('GETT', categories),
    ).rejects.toThrow('gateway 503');
    expect(reportSwallowedError).not.toHaveBeenCalled();

    await expect(
      suggester.suggestCategory('GETT', categories),
    ).resolves.toBeNull();
    expect(reportSwallowedError).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error) }),
      'Jev API error',
    );
  });

  it.each([
    {
      route: 'gateway',
      env: { AI_GATEWAY_API_KEY: 'test-gateway-key', TYPESAFE_AI_API_KEY: '' },
      factory: createGateway,
      other: createTypeSafeAi,
      modelId: 'typesafe-ai/jev',
    },
    {
      route: 'direct TypeSafe',
      env: { AI_GATEWAY_API_KEY: '', TYPESAFE_AI_API_KEY: 'test-typesafe-key' },
      factory: createTypeSafeAi,
      other: createGateway,
      modelId: 'jev-latest',
    },
  ])(
    'calls the $route route with its own model id',
    async ({ env, factory, other, modelId }) => {
      Object.entries(env).forEach(([name, value]) => vi.stubEnv(name, value));
      evaluate.mockResolvedValue(jevAnswer('Taxi', 0.7));

      await new JevCategorySuggester().suggestCategory('GETT', categories);

      expect(factory).toHaveBeenCalledOnce();
      expect(other).not.toHaveBeenCalled();
      expect(evaluationModel).toHaveBeenCalledWith(modelId);
    },
  );

  it('reads no key until a call is made, then fails the call rather than the import', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');

    const suggester = new JevCategorySuggester();
    expect(createGateway).not.toHaveBeenCalled();

    await expect(
      suggester.suggestCategory('GETT', categories),
    ).resolves.toBeNull();
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
