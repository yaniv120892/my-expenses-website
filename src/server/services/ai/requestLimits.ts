/**
 * Bounds each provider call behind AIProvider, not the batch that makes them
 * one row at a time: a stalled answer fails its row instead of inheriting the
 * OpenAI SDK default of 10 minutes with 2 retries. OpenAI and the AI SDK's
 * `evaluate` read `maxRetries`; `@google/generative-ai` has no retry.
 */
export const AI_REQUEST_LIMITS = {
  timeoutMs: 30_000,
  maxRetries: 1,
} as const;
