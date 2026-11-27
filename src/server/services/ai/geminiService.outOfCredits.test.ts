import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeminiService as GeminiServiceClass } from '@/server/services/ai/geminiService';

const { incrementWithTtl } = vi.hoisted(() => ({ incrementWithTtl: vi.fn() }));

vi.mock('@/server/redis', () => ({ incrementWithTtl }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureRequestError: vi.fn() }));

const CREDITS_DEPLETED_BODY = {
  error: {
    code: 402,
    message:
      'Your prepayment credits are depleted. Please go to AI Studio at https://ai.studio/projects to manage your project and billing.',
    status: 'RESOURCE_EXHAUSTED',
  },
};

const SERVER_ERROR_BODY = { error: { code: 500, message: 'Internal error', status: 'INTERNAL' } };

let GeminiService: typeof GeminiServiceClass;
let geminiAnswer: { status: number; body: unknown };
const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
  if (String(input).startsWith('https://api.telegram.org/')) {
    return new Response('{"ok":true}');
  }
  return new Response(JSON.stringify(geminiAnswer.body), {
    status: geminiAnswer.status,
    headers: { 'content-type': 'application/json' },
  });
});

function claimsOf(key: string): number {
  return incrementWithTtl.mock.calls.filter(([calledKey]) => calledKey === key).length;
}

function telegramMessages(): string[] {
  return fetchMock.mock.calls
    .filter(([input]) => String(input).startsWith('https://api.telegram.org/'))
    .map(([, init]) => String(init?.body));
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  globalThis.observabilityByService = undefined;
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.stubEnv('TELEGRAM_BOT_TOKEN', 'bot-token');
  vi.stubEnv('TELEGRAM_ALERT_CHAT_ID', 'ops-chat');
  vi.stubGlobal('fetch', fetchMock);
  const countByKey = new Map<string, number>();
  incrementWithTtl.mockImplementation(async (key: string) => {
    const count = (countByKey.get(key) ?? 0) + 1;
    countByKey.set(key, count);
    return count;
  });
  ({ GeminiService } = await import('@/server/services/ai/geminiService'));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  globalThis.observabilityByService = undefined;
});

describe('GeminiService when the prepaid credits run out', () => {
  it('sends one ops alert for repeated out-of-credits answers and still falls back', async () => {
    geminiAnswer = { status: 402, body: CREDITS_DEPLETED_BODY };
    const gemini = new GeminiService();

    await expect(gemini.analyzeExpenses('summary')).resolves.toBeNull();
    await expect(gemini.analyzeExpenses('summary')).resolves.toBeNull();
    await expect(gemini.generateContent('prompt')).resolves.toBe('');
    await expect(
      gemini.suggestCategory({ description: 'coffee', type: 'EXPENSE' }, [
        { id: 'cat-food', name: 'Food' },
      ]),
    ).resolves.toBeNull();

    await vi.waitFor(() => {
      expect(claimsOf('ai-out-of-credits-alert:Gemini')).toBe(4);
      expect(telegramMessages()).toHaveLength(1);
    });
    const messages = telegramMessages();
    expect(messages[0]).toContain('Gemini is out of credits');
    expect(messages[0]).toContain('operation: analyzeExpenses');
  });

  it('sends no credits alert for any other provider failure', async () => {
    geminiAnswer = { status: 500, body: SERVER_ERROR_BODY };

    await expect(new GeminiService().analyzeExpenses('summary')).resolves.toBeNull();

    expect(telegramMessages()).toEqual([]);
  });
});
