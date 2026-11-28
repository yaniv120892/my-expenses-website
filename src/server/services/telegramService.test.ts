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

    const sending = telegramService.sendPlainMessageWaitingOutRateLimits(
      'chat-1',
      'Transaction Created',
    );
    await vi.advanceTimersByTimeAsync(2_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(sending).resolves.toMatchObject({ message_id: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops resending once the waits would pass the 30 s budget', async () => {
    fetchMock.mockImplementation(async () => tooManyRequests(12));
    const telegramService = await loadTelegramService();

    const sending = telegramService.sendPlainMessageWaitingOutRateLimits('chat-1', 'hi');
    const rejected = expect(sending).rejects.toMatchObject({ errorCode: 429 });
    await vi.advanceTimersByTimeAsync(24_000);
    await rejected;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up without waiting when retry_after is longer than the budget', async () => {
    fetchMock.mockResolvedValue(tooManyRequests(42));
    const telegramService = await loadTelegramService();

    await expect(
      telegramService.sendPlainMessageWaitingOutRateLimits('chat-1', 'hi'),
    ).rejects.toMatchObject({ errorCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not resend a 429 that names no wait', async () => {
    fetchMock.mockResolvedValue(
      telegramReply({ ok: false, error_code: 429, description: 'Too Many Requests' }),
    );
    const telegramService = await loadTelegramService();

    await expect(
      telegramService.sendPlainMessageWaitingOutRateLimits('chat-1', 'hi'),
    ).rejects.toMatchObject({ errorCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not resend a 429 whose wait is zero, which would never spend the budget', async () => {
    fetchMock.mockImplementation(async () => tooManyRequests(0));
    const telegramService = await loadTelegramService();

    await expect(
      telegramService.sendPlainMessageWaitingOutRateLimits('chat-1', 'hi'),
    ).rejects.toMatchObject({ errorCode: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not resend after an error other than a 429', async () => {
    fetchMock.mockResolvedValue(
      telegramReply({ ok: false, error_code: 400, description: 'Bad Request: chat not found' }),
    );
    const telegramService = await loadTelegramService();

    await expect(
      telegramService.sendPlainMessageWaitingOutRateLimits('chat-1', 'hi'),
    ).rejects.toMatchObject({ errorCode: 400 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never waits out a 429 on a plain send, which a webhook reply uses', async () => {
    fetchMock.mockResolvedValue(tooManyRequests(1));
    const telegramService = await loadTelegramService();

    await expect(telegramService.sendPlainMessage('chat-1', 'hi')).rejects.toMatchObject({
      errorCode: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
