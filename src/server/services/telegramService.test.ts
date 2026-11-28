import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/observability', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const fetchMock = vi.fn<typeof fetch>();

function telegramReply(body: object): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const sent = () => telegramReply({ ok: true, result: { message_id: 1 } });
const tooManyRequests = (retryAfterSeconds: number) =>
  telegramReply({
    ok: false,
    error_code: 429,
    description: `Too Many Requests: retry after ${retryAfterSeconds}`,
    parameters: { retry_after: retryAfterSeconds },
  });

async function loadTelegramService() {
  vi.resetModules();
  return (await import('@/server/services/telegramService')).telegramService;
}

describe('telegramService rate limiting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sends the message again once the retry_after of a 429 has passed', async () => {
    fetchMock.mockResolvedValueOnce(tooManyRequests(3)).mockResolvedValueOnce(sent());
    const telegramService = await loadTelegramService();

    const sending = telegramService.sendPlainMessage('chat-1', 'Transaction Created');
    await vi.advanceTimersByTimeAsync(2_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(sending).resolves.toMatchObject({ message_id: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up without waiting when retry_after is longer than a request can hold', async () => {
    fetchMock.mockResolvedValue(tooManyRequests(600));
    const telegramService = await loadTelegramService();

    await expect(telegramService.sendPlainMessage('chat-1', 'hi')).rejects.toMatchObject({
      errorCode: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not resend after an error other than a 429', async () => {
    fetchMock.mockResolvedValue(
      telegramReply({ ok: false, error_code: 400, description: 'Bad Request: chat not found' }),
    );
    const telegramService = await loadTelegramService();

    await expect(telegramService.sendPlainMessage('chat-1', 'hi')).rejects.toMatchObject({
      errorCode: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
