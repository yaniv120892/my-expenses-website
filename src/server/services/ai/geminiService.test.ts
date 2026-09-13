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

const RETIRED_MODEL_ERROR = new Error(
  '[404 Not Found] This model models/gemini-2.0-flash is no longer available.',
);

function textResponse(text: string): unknown {
  return { response: { candidates: [{ content: { parts: [{ text }] } }] } };
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

    // Prose here is what turned a retired model into "Failed to parse AI
    // insights response" — a parse error naming the wrong culprit.
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
