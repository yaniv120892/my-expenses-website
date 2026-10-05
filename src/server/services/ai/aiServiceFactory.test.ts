import { describe, it, expect, vi, afterEach } from 'vitest';
import AIServiceFactory from '@/server/services/ai/aiServiceFactory';
import { GeminiService } from '@/server/services/ai/geminiService';
import { JevCategorySuggester } from '@/server/services/ai/jevCategorySuggester';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('AIServiceFactory.getCategorySuggester', () => {
  it('follows AI_PROVIDER when the category flag is unset', () => {
    vi.stubEnv('AI_PROVIDER', 'gemini');
    vi.stubEnv('AI_CATEGORY_SUGGESTER', '');

    expect(AIServiceFactory.getCategorySuggester()).toBeInstanceOf(
      GeminiService,
    );
  });

  it('routes the category decision to Jev when the flag says so', () => {
    vi.stubEnv('AI_PROVIDER', 'gemini');
    vi.stubEnv('AI_CATEGORY_SUGGESTER', 'JEV');

    expect(AIServiceFactory.getCategorySuggester()).toBeInstanceOf(
      JevCategorySuggester,
    );
  });

  it('refuses a value it does not know instead of falling back', () => {
    vi.stubEnv('AI_CATEGORY_SUGGESTER', 'jevv');

    expect(() => AIServiceFactory.getCategorySuggester()).toThrow(
      /AI_CATEGORY_SUGGESTER "jevv"/,
    );
  });
});
