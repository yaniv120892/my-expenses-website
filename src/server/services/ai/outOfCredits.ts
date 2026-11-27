import { z } from 'zod';

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

// A service that relays a provider failure as text keeps the SDK's
// `<url>: [<status> <statusText>]` shape; the URL keeps a status quoted from file content out.
const PAYMENT_REQUIRED_MARKER = new RegExp(`https?://\\S+: \\[${PAYMENT_REQUIRED_STATUS}[ \\]]`);

export function isOutOfCreditsMessage(message: string): boolean {
  return PAYMENT_REQUIRED_MARKER.test(message);
}
