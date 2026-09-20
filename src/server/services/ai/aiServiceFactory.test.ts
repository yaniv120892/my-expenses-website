import { describe, it, expect, vi, afterEach } from 'vitest';

const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));
vi.mock('@/server/logging/logger', () => ({
  default: { warn, debug: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import AIServiceFactory from '@/server/services/ai/aiServiceFactory';
import { GeminiService } from '@/server/services/ai/geminiService';
import { JevCategorySuggester } from '@/server/services/ai/jevCategorySuggester';

afterEach(() => {
  vi.unstubAllEnvs();
  warn.mockClear();
});

describe('AIServiceFactory.getCategorySuggester', () => {
  it('follows AI_PROVIDER when the category flag is unset', () => {
    vi.stubEnv('AI_PROVIDER', 'gemini');
    vi.stubEnv('AI_CATEGORY_SUGGESTER', '');

    expect(AIServiceFactory.getCategorySuggester()).toBeInstanceOf(
      GeminiService,
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('routes the category decision to Jev when the flag says so', () => {
    vi.stubEnv('AI_PROVIDER', 'gemini');
    vi.stubEnv('AI_CATEGORY_SUGGESTER', 'JEV');

    expect(AIServiceFactory.getCategorySuggester()).toBeInstanceOf(
      JevCategorySuggester,
    );
  });

  it('warns and falls back to AI_PROVIDER on a value it does not know', () => {
    vi.stubEnv('AI_PROVIDER', 'gemini');
    vi.stubEnv('AI_CATEGORY_SUGGESTER', 'jevv');

    expect(AIServiceFactory.getCategorySuggester()).toBeInstanceOf(
      GeminiService,
    );
    expect(warn).toHaveBeenCalledWith(
      { categorySuggester: 'jevv' },
      expect.stringContaining('Unknown AI_CATEGORY_SUGGESTER'),
    );
  });
});
