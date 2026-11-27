export type AIProviderName = 'ChatGPT' | 'Claude' | 'Gemini' | 'Jev';

export type CreditsAlert = {
  provider: AIProviderName;
  error: unknown;
  context: Record<string, string>;
};
