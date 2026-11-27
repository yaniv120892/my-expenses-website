// OpenAI, Anthropic and the AI SDK's `evaluate` read `maxRetries`; `@google/generative-ai`
// has no retry.
export const AI_REQUEST_LIMITS = {
  timeoutMs: 30_000,
  maxRetries: 1,
  categoryMaxOutputTokens: 50,
  // A thinking model bills its reasoning as output and returns no answer when the cap cuts the
  // reasoning short, so its cap leaves room for that and still bounds the spend.
  thinkingCategoryMaxOutputTokens: 2048,
  // Same reasoning for a short prose answer (an insight, a summary) from a thinking model.
  thinkingAnswerMaxOutputTokens: 4096,
} as const;
