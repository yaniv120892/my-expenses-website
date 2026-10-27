import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAssistantModel } from '@/server/services/assistant/model';

describe('getAssistantModel', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the provider default when ASSISTANT_MODEL_ID is unset', () => {
    vi.stubEnv('AI_PROVIDER', 'gemini');
    vi.stubEnv('ASSISTANT_MODEL_ID', '');

    expect(getAssistantModel()).toMatchObject({ id: 'google/gemini-2.5-flash' });
  });

  it('uses a provider/model override as given', () => {
    vi.stubEnv('AI_PROVIDER', 'chatgpt');
    vi.stubEnv('ASSISTANT_MODEL_ID', 'openai/gpt-4.1');

    expect(getAssistantModel()).toMatchObject({ id: 'openai/gpt-4.1' });
  });

  it('refuses an override that names no provider', () => {
    vi.stubEnv('ASSISTANT_MODEL_ID', 'gpt-4.1');

    expect(() => getAssistantModel()).toThrow(/ASSISTANT_MODEL_ID: gpt-4.1/);
  });
});
