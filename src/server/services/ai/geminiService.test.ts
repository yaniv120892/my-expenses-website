import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { generateContent, reportSwallowedError } = vi.hoisted(() => ({
  generateContent: vi.fn(),
  reportSwallowedError: vi.fn(),
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
vi.mock('@/server/logging/reportSwallowedError', () => ({
  reportSwallowedError,
}));

import { GeminiService } from '@/server/services/ai/geminiService';
import { SUGGEST_CATEGORY_SYSTEM_PROMPT } from '@/server/services/ai/prompts';

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
    expect(reportSwallowedError).toHaveBeenCalledWith(
      expect.objectContaining({ err: RETIRED_MODEL_ERROR }),
      'Gemini API error',
    );
  });

  it('returns null when the provider answers with no content', async () => {
    generateContent.mockResolvedValue({ response: { candidates: [] } });

    await expect(new GeminiService().analyzeExpenses('summary')).resolves.toBe(
      null,
    );
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

    const { model } = getGenerativeModel.mock.calls[0][0];
    expect(model).not.toBe('gemini-2.0-flash');
    expect(model).toBe('gemini-3.6-flash');
  });

  it('honours GEMINI_MODEL so a retirement needs no deploy', async () => {
    process.env.GEMINI_MODEL = 'gemini-9.9-flash';
    generateContent.mockResolvedValue(textResponse('ok'));

    await new GeminiService().analyzeExpenses('summary');

    expect(getGenerativeModel.mock.calls[0][0].model).toBe('gemini-9.9-flash');
  });

  it('reads the override per call, not once at module load', async () => {
    generateContent.mockResolvedValue(textResponse('ok'));
    const service = new GeminiService();

    await service.analyzeExpenses('first');
    process.env.GEMINI_MODEL = 'gemini-switched';
    await service.analyzeExpenses('second');

    expect(getGenerativeModel.mock.calls[1][0].model).toBe('gemini-switched');
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

    const evaluation = await new GeminiService().evaluateCategory(
      'GETT',
      categories,
    );

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

    expect(generateContent.mock.calls[0][0].systemInstruction).toBe(
      SUGGEST_CATEGORY_SYSTEM_PROMPT,
    );
  });

  it('keeps an answer that names no offered category, without an id', async () => {
    generateContent.mockResolvedValue(textResponse('Transportation'));

    const evaluation = await new GeminiService().evaluateCategory(
      'GETT',
      categories,
    );

    expect(evaluation).toMatchObject({
      categoryId: null,
      categoryName: 'Transportation',
    });
  });

  it('rejects on provider failure where suggestCategory swallows', async () => {
    generateContent.mockRejectedValue(RETIRED_MODEL_ERROR);

    await expect(
      new GeminiService().evaluateCategory('GETT', categories),
    ).rejects.toBe(RETIRED_MODEL_ERROR);
    expect(reportSwallowedError).not.toHaveBeenCalled();

    await expect(
      new GeminiService().suggestCategory('GETT', categories),
    ).resolves.toBeNull();
    expect(reportSwallowedError).toHaveBeenCalledTimes(1);
  });
});
