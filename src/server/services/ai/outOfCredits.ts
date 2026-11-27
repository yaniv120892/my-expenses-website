import { z } from 'zod';
import type { AIProviderName } from '@/server/services/ai/creditsAlert.types';

const PAYMENT_REQUIRED_STATUS = 402;
const BAD_REQUEST_STATUS = 400;
// Anthropic can answer an empty balance with a plain 400 invalid_request_error and only this text.
const ANTHROPIC_LOW_BALANCE_TEXT = 'credit balance is too low';
// OpenAI answers an empty balance with 429 and this code, so the status alone reads as a rate limit.
const OPENAI_NO_QUOTA_CODE = 'insufficient_quota';

// SDKs name the HTTP status differently: `status` (Google, OpenAI), `statusCode` (AI SDK).
const providerFailureSchema = z.object({
  status: z.unknown().optional(),
  statusCode: z.unknown().optional(),
  code: z.unknown().optional(),
  message: z.unknown().optional(),
});

export function isOutOfCredits(error: unknown): boolean {
  const parsed = providerFailureSchema.safeParse(error);
  if (!parsed.success) {
    return false;
  }
  const { status, statusCode, code, message } = parsed.data;
  const isAnthropicLowBalance =
    (status === BAD_REQUEST_STATUS || statusCode === BAD_REQUEST_STATUS) &&
    typeof message === 'string' &&
    message.includes(ANTHROPIC_LOW_BALANCE_TEXT);
  return (
    status === PAYMENT_REQUIRED_STATUS ||
    statusCode === PAYMENT_REQUIRED_STATUS ||
    code === OPENAI_NO_QUOTA_CODE ||
    isAnthropicLowBalance
  );
}

// A service that relays a provider failure as text keeps its SDK's message shape: Google's
// `<url>: [<status> <statusText>]`, Anthropic's `<status> <JSON body>`. Anchoring on the URL or
// the JSON error type keeps a status quoted from file content out.
const GEMINI_PAYMENT_REQUIRED_MARKER = new RegExp(
  `https?://\\S+: \\[${PAYMENT_REQUIRED_STATUS}[ \\]]`,
);
const ANTHROPIC_BILLING_ERROR_MARKER = new RegExp(
  `^(?:.*: )?(?:${PAYMENT_REQUIRED_STATUS} \\{.*"type":"billing_error"|${BAD_REQUEST_STATUS} \\{.*"type":"invalid_request_error".*${ANTHROPIC_LOW_BALANCE_TEXT})`,
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
