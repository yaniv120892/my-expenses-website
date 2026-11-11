import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type * as ObservabilityModule from '@/server/observability';

const { generateContent, reportError } = vi.hoisted(() => ({
  generateContent: vi.fn(),
  reportError: vi.fn(),
}));

const getGenerativeModel = vi.fn((params: { model: string }) => {
  void params;
  return { generateContent };
});

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    public getGenerativeModel = getGenerativeModel;
  },
}));
vi.mock('@/server/observability', async (importOriginal) => ({
  ...(await importOriginal<typeof ObservabilityModule>()),
  observability: { reportError },
}));

import { GeminiService } from '@/server/services/ai/geminiService';
import type { ImportedChargeToMatch } from '@/server/services/ai/aiProvider';
import {
  SUGGEST_CATEGORY_SYSTEM_PROMPT,
  FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT,
  buildAnalyzeExpensesPrompt,
  buildFindMatchingTransactionPrompt,
} from '@/server/services/ai/prompts';
import type { Transaction } from '@/shared/types/transaction';

const RETIRED_MODEL_ERROR = new Error(
  '[404 Not Found] This model models/gemini-2.0-flash is no longer available.',
);

function textResponse(
  text: string,
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  },
): unknown {
  return {
    response: {
      candidates: [{ content: { parts: [{ text }] } }],
      usageMetadata,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.GEMINI_API_KEY = 'test-key';
  delete process.env.GEMINI_MODEL;
});

afterEach(() => {
  delete process.env.GEMINI_MODEL;
});

describe('GeminiService.analyzeExpenses', () => {
  it('returns null rather than prose when the provider call fails', async () => {
    generateContent.mockRejectedValue(RETIRED_MODEL_ERROR);

    const result = await new GeminiService().analyzeExpenses('summary');

    expect(result).toBeNull();
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ error: RETIRED_MODEL_ERROR, where: 'Gemini API error' }),
    );
  });

  it('returns null when the provider answers with no content', async () => {
    generateContent.mockResolvedValue({ response: { candidates: [] } });

    await expect(new GeminiService().analyzeExpenses('summary')).resolves.toBe(null);
  });

  it('returns the analysis when the call succeeds', async () => {
    generateContent.mockResolvedValue(textResponse('spending looks fine'));

    await expect(new GeminiService().analyzeExpenses('summary')).resolves.toBe(
      'spending looks fine',
    );
  });
});

describe('GeminiService model id', () => {
  it('defaults to a model that is not the retired one', async () => {
    generateContent.mockResolvedValue(textResponse('ok'));

    await new GeminiService().analyzeExpenses('summary');

    const [options] = getGenerativeModel.mock.calls[0] ?? [];
    expect(options?.model).not.toBe('gemini-2.0-flash');
    expect(options?.model).toBe('gemini-3.6-flash');
  });

  it('honours GEMINI_MODEL so a retirement needs no deploy', async () => {
    process.env.GEMINI_MODEL = 'gemini-9.9-flash';
    generateContent.mockResolvedValue(textResponse('ok'));

    await new GeminiService().analyzeExpenses('summary');

    expect(getGenerativeModel.mock.calls[0]?.[0].model).toBe('gemini-9.9-flash');
  });

  it('reads the override per call, not once at module load', async () => {
    generateContent.mockResolvedValue(textResponse('ok'));
    const service = new GeminiService();

    await service.analyzeExpenses('first');
    process.env.GEMINI_MODEL = 'gemini-switched';
    await service.analyzeExpenses('second');

    expect(getGenerativeModel.mock.calls[1]?.[0].model).toBe('gemini-switched');
  });
});

describe('GeminiService.evaluateCategory', () => {
  const categories = [
    { id: 'cat-taxi', name: 'Taxi' },
    { id: 'cat-car', name: 'Car' },
  ];

  it('resolves a quoted answer to a category id and counts thinking tokens as output', async () => {
    generateContent.mockResolvedValue(
      textResponse(' "Taxi"\n', {
        promptTokenCount: 120,
        candidatesTokenCount: 2,
        totalTokenCount: 322,
      }),
    );

    const evaluation = await new GeminiService().evaluateCategory('GETT', categories);

    expect(evaluation).toEqual({
      categoryId: 'cat-taxi',
      categoryName: 'Taxi',
      probability: null,
      inputTokens: 120,
      outputTokens: 202,
    });
  });

  it('sends the same system prompt the OpenAI provider sends', async () => {
    generateContent.mockResolvedValue(textResponse('Taxi'));

    await new GeminiService().evaluateCategory('GETT', categories);

    expect(generateContent.mock.calls[0]?.[0].systemInstruction).toBe(
      SUGGEST_CATEGORY_SYSTEM_PROMPT,
    );
  });

  it('caps the output, leaving room for a thinking model to reason', async () => {
    generateContent.mockResolvedValue(textResponse('Taxi'));

    await new GeminiService().evaluateCategory('GETT', categories);

    expect(generateContent.mock.calls[0]?.[0].generationConfig).toEqual({
      maxOutputTokens: 2048,
    });
  });

  it('keeps an answer that names no offered category, without an id', async () => {
    generateContent.mockResolvedValue(textResponse('Transportation'));

    const evaluation = await new GeminiService().evaluateCategory('GETT', categories);

    expect(evaluation).toMatchObject({
      categoryId: null,
      categoryName: 'Transportation',
    });
  });

  it('rejects on provider failure where suggestCategory swallows', async () => {
    generateContent.mockRejectedValue(RETIRED_MODEL_ERROR);

    await expect(new GeminiService().evaluateCategory('GETT', categories)).rejects.toBe(
      RETIRED_MODEL_ERROR,
    );
    expect(reportError).not.toHaveBeenCalled();

    await expect(new GeminiService().suggestCategory('GETT', categories)).resolves.toBeNull();
    expect(reportError).toHaveBeenCalledTimes(1);
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

describe('GeminiService.generateContent', () => {
  it('sends the prompt as the only user part and returns the raw text', async () => {
    generateContent.mockResolvedValue(textResponse(' "Spend less"\n'));

    await expect(new GeminiService().generateContent('advise me')).resolves.toBe(' "Spend less"\n');
    expect(generateContent).toHaveBeenCalledWith({
      contents: [{ role: 'user', parts: [{ text: 'advise me' }] }],
    });
  });

  it('returns an empty string when the provider answers with no content', async () => {
    generateContent.mockResolvedValue({ response: { candidates: [] } });

    await expect(new GeminiService().generateContent('advise me')).resolves.toBe('');
  });

  it('reports a provider failure and returns an empty string', async () => {
    generateContent.mockRejectedValue(RETIRED_MODEL_ERROR);

    await expect(new GeminiService().generateContent('advise me')).resolves.toBe('');
    expect(reportError).toHaveBeenCalledWith({
      error: RETIRED_MODEL_ERROR,
      where: 'Gemini API error',
      context: { model: 'gemini-3.6-flash' },
    });
  });
});

describe('GeminiService.analyzeExpenses request', () => {
  it('sends the analysis prompt as the only user part, with no system instruction', async () => {
    generateContent.mockResolvedValue(textResponse('Food went up'));

    await new GeminiService().analyzeExpenses('summary', 'in one line');

    expect(generateContent).toHaveBeenCalledWith({
      contents: [
        {
          role: 'user',
          parts: [{ text: buildAnalyzeExpensesPrompt('summary', 'in one line') }],
        },
      ],
    });
  });
});

describe('GeminiService.findMatchingTransaction', () => {
  it('makes no call when there is nothing to match against', async () => {
    await expect(
      new GeminiService().findMatchingTransaction(importedCharge, []),
    ).resolves.toBeNull();
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('returns the quoted match the model names, asked deterministically', async () => {
    generateContent.mockResolvedValue(textResponse(' "tx-a"\n'));

    await expect(
      new GeminiService().findMatchingTransaction(importedCharge, [matchCandidate]),
    ).resolves.toBe('tx-a');
    expect(generateContent).toHaveBeenCalledWith({
      systemInstruction: FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT,
      contents: [
        {
          role: 'user',
          parts: [{ text: buildFindMatchingTransactionPrompt(importedCharge, [matchCandidate]) }],
        },
      ],
      generationConfig: { temperature: 0 },
    });
  });

  it('reports a provider failure under its own label and returns null', async () => {
    generateContent.mockRejectedValue(RETIRED_MODEL_ERROR);

    await expect(
      new GeminiService().findMatchingTransaction(importedCharge, [matchCandidate]),
    ).resolves.toBeNull();
    expect(reportError).toHaveBeenCalledWith({
      error: RETIRED_MODEL_ERROR,
      where: 'Error finding matching transaction',
      context: { model: 'gemini-3.6-flash' },
    });
  });
});

describe('GeminiService.suggestCategory', () => {
  it('reports a provider failure with the model and returns null', async () => {
    generateContent.mockRejectedValue(RETIRED_MODEL_ERROR);

    await expect(
      new GeminiService().suggestCategory('GETT', [{ id: 'cat-taxi', name: 'Taxi' }]),
    ).resolves.toBeNull();
    expect(reportError).toHaveBeenCalledWith({
      error: RETIRED_MODEL_ERROR,
      where: 'Gemini API error',
      context: { model: 'gemini-3.6-flash' },
    });
  });
});
