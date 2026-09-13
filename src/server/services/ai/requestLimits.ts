/**
 * Bounds each provider call behind AIProvider, not the batch that makes them
 * one row at a time: a stalled answer fails its row instead of inheriting the
 * OpenAI SDK default of 10 minutes with 2 retries. `@google/generative-ai` has
 * no retry, so only OpenAI reads `maxRetries`.
 */
export const AI_REQUEST_LIMITS = {
  timeoutMs: 30_000,
  maxRetries: 1,
} as const;
