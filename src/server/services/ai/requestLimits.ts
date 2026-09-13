/**
 * Bounds every provider call behind AIProvider. The calls are short structured
 * answers made one row at a time inside a batch request, so a stalled response
 * must fail its row well inside a serverless function's lifetime rather than
 * inherit the OpenAI SDK default of 10 minutes with 2 retries.
 * `@google/generative-ai` has no retry, so a Gemini call is bounded by
 * `timeoutMs` alone.
 */
export const AI_REQUEST_LIMITS = {
  timeoutMs: 30_000,
  maxRetries: 1,
} as const;
