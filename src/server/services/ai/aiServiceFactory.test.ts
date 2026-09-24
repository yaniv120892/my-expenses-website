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

  it.each([
    { flag: 'JEV', strategy: 'flat' },
    { flag: 'jev-two-step', strategy: 'two-step' },
  ])(
    'routes the category decision to $strategy Jev on $flag',
    ({ flag, strategy }) => {
      vi.stubEnv('AI_PROVIDER', 'gemini');
      vi.stubEnv('AI_CATEGORY_SUGGESTER', flag);

      const suggester = AIServiceFactory.getCategorySuggester();

      expect(suggester).toBeInstanceOf(JevCategorySuggester);
      expect(suggester).toMatchObject({ strategy });
    },
  );

  it('refuses a value it does not know instead of falling back', () => {
    vi.stubEnv('AI_CATEGORY_SUGGESTER', 'jevv');

    expect(() => AIServiceFactory.getCategorySuggester()).toThrow(
      /AI_CATEGORY_SUGGESTER "jevv"/,
    );
  });
});
