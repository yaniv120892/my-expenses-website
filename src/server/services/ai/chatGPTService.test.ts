import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type * as ObservabilityModule from '@/server/observability';
import type { ClientOptions } from 'openai';
import type * as OpenAIModule from 'openai';

const { reportError, hangingFetch, constructedWith } = vi.hoisted(() => {
  const constructedWith: unknown[] = [];
  return { reportError: vi.fn(), hangingFetch: vi.fn(), constructedWith };
});

vi.mock('openai', async (importOriginal) => {
  const actual = await importOriginal<typeof OpenAIModule>();
  class RecordingOpenAI extends actual.default {
    public constructor(options: ClientOptions) {
      constructedWith.push(options);
      super({ ...options, fetch: hangingFetch });
    }
  }
  return { ...actual, default: RecordingOpenAI };
});
vi.mock('@/server/observability', async (importOriginal) => ({
  ...(await importOriginal<typeof ObservabilityModule>()),
  observability: { reportError },
}));

import { APIConnectionTimeoutError } from 'openai';
import { ChatGPTService } from '@/server/services/ai/chatGPTService';
import { AI_REQUEST_LIMITS } from '@/server/services/ai/requestLimits';
import type { Category } from '@/shared/types/category';
import type { Transaction } from '@/shared/types/transaction';
import type { ImportedChargeToMatch } from '@/server/services/ai/aiProvider';
import { FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT } from '@/server/services/ai/prompts';
import { stalledFetch } from '@/test/stalledFetch';
import { trackSettled } from '@/test/trackSettled';

hangingFetch.mockImplementation(stalledFetch);

const categories: Category[] = [{ id: 'cat-food', name: 'Food' }];
const RETRY_BACKOFF_ALLOWANCE_MS = 2_000;

beforeEach(() => {
  vi.clearAllMocks();
  constructedWith.length = 0;
  process.env.OPENAI_API_KEY = 'test-key';
  delete process.env.OPENAI_MODEL;
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('ChatGPTService request limits', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds the client with the shared timeout and retry count', async () => {
    const pending = new ChatGPTService().suggestCategory('coffee', categories);
    await vi.runAllTimersAsync();
    await pending;

    expect(constructedWith).toEqual([expect.objectContaining({ timeout: 30_000, maxRetries: 1 })]);
  });

  it('does not build the client until a call is made', () => {
    new ChatGPTService();

    expect(constructedWith).toHaveLength(0);
  });

  it('fails a stalled call after the timeout and one retry instead of hanging', async () => {
    const { pending, isSettled } = trackSettled(
      new ChatGPTService().suggestCategory('coffee', categories),
    );

    await vi.advanceTimersByTimeAsync(AI_REQUEST_LIMITS.timeoutMs - 1);
    expect(isSettled()).toBe(false);

    await vi.advanceTimersByTimeAsync(AI_REQUEST_LIMITS.timeoutMs + RETRY_BACKOFF_ALLOWANCE_MS);

    expect(isSettled()).toBe(true);
    await expect(pending).resolves.toBeNull();
    expect(hangingFetch).toHaveBeenCalledTimes(2);
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(APIConnectionTimeoutError),
        where: 'ChatGPT API error',
      }),
    );
  });
});

describe('ChatGPTService.evaluateCategory', () => {
  it('resolves the answer to a category id and reports token usage', async () => {
    hangingFetch.mockImplementationOnce(async () =>
      jsonResponse(200, {
        choices: [{ message: { role: 'assistant', content: ' "Food" \n' } }],
        usage: { prompt_tokens: 140, completion_tokens: 2 },
      }),
    );

    const evaluation = await new ChatGPTService().evaluateCategory('coffee', categories);

    expect(evaluation).toEqual({
      categoryId: 'cat-food',
      categoryName: 'Food',
      probability: null,
      inputTokens: 140,
      outputTokens: 2,
    });
  });

  it('asks a cheap model for a capped answer unless OPENAI_MODEL overrides it', async () => {
    delete process.env.OPENAI_MODEL;
    hangingFetch.mockImplementationOnce(async () =>
      jsonResponse(200, { choices: [{ message: { role: 'assistant', content: 'Food' } }] }),
    );

    await new ChatGPTService().evaluateCategory('coffee', categories);

    const [, init] = hangingFetch.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'gpt-4o-mini',
      max_tokens: 50,
    });
  });

  it('returns no name when the completion has no choices', async () => {
    hangingFetch.mockImplementationOnce(async () =>
      jsonResponse(200, { choices: [], usage: { prompt_tokens: 140 } }),
    );

    const evaluation = await new ChatGPTService().evaluateCategory('coffee', categories);

    expect(evaluation).toMatchObject({ categoryId: null, categoryName: null });
  });

  it('rejects on provider failure where suggestCategory swallows', async () => {
    hangingFetch.mockImplementation(async () =>
      jsonResponse(400, { error: { message: 'bad request' } }),
    );

    await expect(
      new ChatGPTService().evaluateCategory('coffee', categories),
    ).rejects.toBeInstanceOf(Error);
    expect(reportError).not.toHaveBeenCalled();

    await expect(new ChatGPTService().suggestCategory('coffee', categories)).resolves.toBeNull();
    expect(reportError).toHaveBeenCalledTimes(1);
    hangingFetch.mockImplementation(stalledFetch);
  });
});

const matchCandidate: Transaction = {
  id: 'tx-a',
  description: 'Coffee',
  value: 10,
  currency: 'ILS',
  originalAmount: 10,
  exchangeRate: null,
  exchangeRateDate: null,
  exchangeRateSource: null,
  date: new Date('2026-03-07T00:00:00Z'),
  type: 'EXPENSE',
  status: 'APPROVED',
  category: { id: 'cat-food', name: 'Food' },
};

const importedCharge: ImportedChargeToMatch = {
  description: 'Coffee',
  value: 10,
  currency: 'ILS',
  originalAmount: 10,
  date: new Date('2026-03-07T00:00:00Z'),
  type: 'EXPENSE',
};

function answering(content: string | null): void {
  hangingFetch.mockImplementationOnce(async () =>
    jsonResponse(200, { choices: [{ message: { role: 'assistant', content } }] }),
  );
}

function failingWithBadRequest(): void {
  hangingFetch.mockImplementationOnce(async () =>
    jsonResponse(400, { error: { message: 'bad request' } }),
  );
}

function sentBody(): Record<string, unknown> {
  const [, init] = hangingFetch.mock.calls[0] ?? [];
  return JSON.parse(String(init?.body));
}

describe('ChatGPTService.generateContent', () => {
  it('returns the completion text', async () => {
    answering('Spend less on coffee');

    await expect(new ChatGPTService().generateContent('advise me')).resolves.toBe(
      'Spend less on coffee',
    );
    expect(sentBody()).toMatchObject({
      messages: [{ role: 'user', content: 'advise me' }],
      max_tokens: 200,
    });
  });

  it('falls back to a placeholder when the completion is empty', async () => {
    answering('');

    await expect(new ChatGPTService().generateContent('advise me')).resolves.toBe(
      'No insights available.',
    );
  });

  it('reports a provider failure and returns an empty string', async () => {
    failingWithBadRequest();

    await expect(new ChatGPTService().generateContent('advise me')).resolves.toBe('');
    expect(reportError).toHaveBeenCalledWith({
      error: expect.any(Error),
      where: 'ChatGPT API error',
      context: { model: 'gpt-4o-mini' },
    });
  });
});

describe('ChatGPTService.analyzeExpenses', () => {
  it('returns the analysis', async () => {
    answering('You spent more on food');

    await expect(new ChatGPTService().analyzeExpenses('summary')).resolves.toBe(
      'You spent more on food',
    );
    expect(sentBody()).toMatchObject({
      messages: [{ role: 'system' }, { role: 'user' }],
      max_tokens: 200,
    });
  });

  it('returns null when the completion is empty', async () => {
    answering(null);

    await expect(new ChatGPTService().analyzeExpenses('summary')).resolves.toBeNull();
  });

  it('reports a provider failure and returns null', async () => {
    failingWithBadRequest();

    await expect(new ChatGPTService().analyzeExpenses('summary')).resolves.toBeNull();
    expect(reportError).toHaveBeenCalledWith({
      error: expect.any(Error),
      where: 'ChatGPT API error',
      context: { model: 'gpt-4o-mini' },
    });
  });
});

describe('ChatGPTService.findMatchingTransaction', () => {
  it('makes no call when there is nothing to match against', async () => {
    await expect(
      new ChatGPTService().findMatchingTransaction(importedCharge, []),
    ).resolves.toBeNull();
    expect(hangingFetch).not.toHaveBeenCalled();
  });

  it('returns the offered match the model names, asked deterministically', async () => {
    answering('tx-a');

    await expect(
      new ChatGPTService().findMatchingTransaction(importedCharge, [matchCandidate]),
    ).resolves.toBe('tx-a');
    expect(sentBody()).toMatchObject({
      messages: [
        { role: 'system', content: FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT },
        { role: 'user' },
      ],
      temperature: 0,
      max_tokens: 50,
    });
  });

  it('reports a provider failure and returns null', async () => {
    failingWithBadRequest();

    await expect(
      new ChatGPTService().findMatchingTransaction(importedCharge, [matchCandidate]),
    ).resolves.toBeNull();
    expect(reportError).toHaveBeenCalledWith({
      error: expect.any(Error),
      where: 'ChatGPT API error',
      context: { model: 'gpt-4o-mini' },
    });
  });
});
