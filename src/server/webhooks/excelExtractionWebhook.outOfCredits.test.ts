import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as WebhookAuthModule from '@/server/utils/webhookAuth';
import type { processExcelExtractionWebhook as ProcessWebhook } from '@/server/webhooks/excelExtractionWebhook';

const { incrementWithTtl, importRepo, crossHouseholdRepo } = vi.hoisted(() => ({
  incrementWithTtl: vi.fn(),
  importRepo: {
    findById: vi.fn(),
    claimExtraction: vi.fn(),
    updateStatus: vi.fn(),
  },
  crossHouseholdRepo: { findImportForExtractionCallback: vi.fn() },
}));

vi.mock('@/server/redis', () => ({ incrementWithTtl }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureRequestError: vi.fn() }));
vi.mock('@/server/utils/webhookAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof WebhookAuthModule>()),
  extractWebhookParams: () => ({ token: 't', userId: 'user-1', timestamp: 123 }),
  verifyWebhookToken: () => true,
}));
vi.mock('@/server/repositories/importRepository', () => ({ importRepository: importRepo }));
vi.mock('@/server/repositories/crossHouseholdRepository', () => ({
  default: crossHouseholdRepo,
}));
vi.mock('@/server/db/client', () => ({ default: {} }));

// The extraction service's error text for a Gemini 402, as production logged it on 2026-11-27.
const CREDITS_DEPLETED_ERROR =
  'AI processing failed: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent: [402 ] Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.';

// The extraction service's error text for an Anthropic 402, as `@anthropic-ai/sdk` builds it.
const CLAUDE_CREDITS_DEPLETED_ERROR =
  'AI processing failed: 402 {"type":"error","error":{"type":"billing_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."},"request_id":"req_011"}';

const SERVER_ERROR =
  'AI processing failed: [GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent: [500 Internal Server Error] Internal error';

let processExcelExtractionWebhook: typeof ProcessWebhook;
const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
  return new Response('{"ok":true}');
});

const CREDITS_ALERT_KEY = 'ai-out-of-credits-alert:Gemini';
const CLAUDE_CREDITS_ALERT_KEY = 'ai-out-of-credits-alert:Claude';

function creditsClaims(key = CREDITS_ALERT_KEY): number {
  return incrementWithTtl.mock.calls.filter(([claimedKey]) => claimedKey === key).length;
}

function telegramMessages(): string[] {
  return fetchMock.mock.calls
    .filter(([input]) => String(input).startsWith('https://api.telegram.org/'))
    .map(([, init]) => String(init?.body));
}

function failedCallback(error: string) {
  return processExcelExtractionWebhook({ requestId: 'req-1', status: 'FAILED', error }, {});
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  globalThis.observabilityByService = undefined;
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'bot-token');
  vi.stubEnv('TELEGRAM_ALERT_CHAT_ID', 'ops-chat');
  vi.stubGlobal('fetch', fetchMock);
  const countByKey = new Map<string, number>();
  incrementWithTtl.mockImplementation(async (key: string) => {
    const count = (countByKey.get(key) ?? 0) + 1;
    countByKey.set(key, count);
    return count;
  });
  const importRecord = {
    id: 'imp-1',
    householdId: 'household-1',
    userId: 'user-1',
    createdAt: new Date('2026-11-27T12:32:00.000Z'),
  };
  crossHouseholdRepo.findImportForExtractionCallback.mockResolvedValue(importRecord);
  importRepo.findById.mockResolvedValue(importRecord);
  importRepo.claimExtraction.mockResolvedValue(true);
  ({ processExcelExtractionWebhook } = await import('@/server/webhooks/excelExtractionWebhook'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  globalThis.observabilityByService = undefined;
});

describe('failed extraction when the AI provider is out of credits', () => {
  it('fails each import and sends one ops alert for the burst', async () => {
    for (let i = 0; i < 4; i++) {
      await expect(failedCallback(CREDITS_DEPLETED_ERROR)).resolves.toMatchObject({ status: 200 });
    }

    expect(importRepo.updateStatus).toHaveBeenCalledTimes(4);
    expect(importRepo.updateStatus).toHaveBeenCalledWith(
      'household-1',
      'imp-1',
      'FAILED',
      CREDITS_DEPLETED_ERROR,
    );
    await vi.waitFor(() => {
      expect(creditsClaims()).toBe(4);
      expect(telegramMessages()).toHaveLength(1);
    });
    expect(incrementWithTtl).toHaveBeenCalledWith(CREDITS_ALERT_KEY, 86_400);
    const [message] = telegramMessages();
    expect(message).toContain('Gemini is out of credits');
    expect(message).toContain('operation: fileExtraction');
    expect(message).toContain('householdId: household-1');
  });

  it('names Claude when the relayed failure is an Anthropic billing error', async () => {
    await failedCallback(CLAUDE_CREDITS_DEPLETED_ERROR);

    await vi.waitFor(() => {
      expect(telegramMessages()).toHaveLength(1);
    });
    expect(creditsClaims(CLAUDE_CREDITS_ALERT_KEY)).toBe(1);
    expect(creditsClaims()).toBe(0);
    expect(telegramMessages()[0]).toContain('Claude is out of credits');
  });

  it('sends no credits alert for any other extraction failure', async () => {
    await failedCallback(SERVER_ERROR);
    await failedCallback('Unsupported file format');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(creditsClaims()).toBe(0);
    expect(telegramMessages()).toEqual([]);
  });
});
