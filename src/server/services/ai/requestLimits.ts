/**
 * Per provider call, not per batch: a stalled answer fails its row instead of
 * inheriting OpenAI's 10-minute, 2-retry default. OpenAI and the AI SDK's
 * `evaluate` read `maxRetries`; `@google/generative-ai` has no retry.
 */
export const AI_REQUEST_LIMITS = {
  timeoutMs: 30_000,
  maxRetries: 1,
} as const;
