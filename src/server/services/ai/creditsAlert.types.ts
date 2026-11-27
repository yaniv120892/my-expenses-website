export type AIProviderName = 'ChatGPT' | 'Gemini' | 'Jev';

export type CreditsAlert = {
  provider: AIProviderName;
  error: unknown;
  context: Record<string, string>;
};
