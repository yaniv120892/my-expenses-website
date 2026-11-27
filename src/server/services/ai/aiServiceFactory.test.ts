import { describe, it, expect, vi, afterEach } from 'vitest';
import aiServiceFactory from '@/server/services/ai/aiServiceFactory';
import { ClaudeService } from '@/server/services/ai/claudeService';
import { GeminiService } from '@/server/services/ai/geminiService';
import { JevCategorySuggester } from '@/server/services/ai/jevCategorySuggester';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('aiServiceFactory.getCategorySuggester', () => {
  it('follows AI_PROVIDER when the category flag is unset', () => {
    vi.stubEnv('AI_PROVIDER', 'gemini');
    vi.stubEnv('AI_CATEGORY_SUGGESTER', '');

    expect(aiServiceFactory.getCategorySuggester()).toBeInstanceOf(GeminiService);
  });

  it('builds the Claude provider for AI_PROVIDER=claude', () => {
    vi.stubEnv('AI_PROVIDER', 'claude');
    vi.stubEnv('AI_CATEGORY_SUGGESTER', '');

    expect(aiServiceFactory.getCategorySuggester()).toBeInstanceOf(ClaudeService);
  });

  it('routes the category decision to Jev when the flag says so', () => {
    vi.stubEnv('AI_PROVIDER', 'gemini');
    vi.stubEnv('AI_CATEGORY_SUGGESTER', 'JEV');

    expect(aiServiceFactory.getCategorySuggester()).toBeInstanceOf(JevCategorySuggester);
  });

  it('refuses a value it does not know instead of falling back', () => {
    vi.stubEnv('AI_CATEGORY_SUGGESTER', 'jevv');

    expect(() => aiServiceFactory.getCategorySuggester()).toThrow(/AI_CATEGORY_SUGGESTER "jevv"/);
  });
});
