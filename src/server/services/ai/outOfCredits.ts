import { z } from 'zod';
import type { AIProviderName } from '@/server/services/ai/creditsAlert.types';

const PAYMENT_REQUIRED_STATUS = 402;
// OpenAI answers an empty balance with 429 and this code, so the status alone reads as a rate limit.
const OPENAI_NO_QUOTA_CODE = 'insufficient_quota';

// SDKs name the HTTP status differently: `status` (Google, OpenAI), `statusCode` (AI SDK).
const providerFailureSchema = z.object({
  status: z.unknown().optional(),
  statusCode: z.unknown().optional(),
  code: z.unknown().optional(),
});

export function isOutOfCredits(error: unknown): boolean {
  const parsed = providerFailureSchema.safeParse(error);
  if (!parsed.success) {
    return false;
  }
  const { status, statusCode, code } = parsed.data;
  return (
    status === PAYMENT_REQUIRED_STATUS ||
    statusCode === PAYMENT_REQUIRED_STATUS ||
    code === OPENAI_NO_QUOTA_CODE
  );
}

// A service that relays a provider failure as text keeps its SDK's message shape: Google's
// `<url>: [<status> <statusText>]`, Anthropic's `<status> <JSON body>`. Anchoring on the URL or
// the JSON error type keeps a status quoted from file content out.
const GEMINI_PAYMENT_REQUIRED_MARKER = new RegExp(
  `https?://\\S+: \\[${PAYMENT_REQUIRED_STATUS}[ \\]]`,
);
const ANTHROPIC_BILLING_ERROR_MARKER = new RegExp(
  `^(?:.*: )?${PAYMENT_REQUIRED_STATUS} \\{.*"type":"billing_error"`,
);

export function outOfCreditsProviderOf(message: string): AIProviderName | null {
  if (ANTHROPIC_BILLING_ERROR_MARKER.test(message)) {
    return 'Claude';
  }
  if (GEMINI_PAYMENT_REQUIRED_MARKER.test(message)) {
    return 'Gemini';
  }
  return null;
}
