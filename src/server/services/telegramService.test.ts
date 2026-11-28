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

const chatNotFound = () =>
  telegramReply({ ok: false, error_code: 400, description: 'Bad Request: chat not found' });

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

    const sending = telegramService.sendPlainMessagesWaitingOutRateLimits('chat-1', [
      'Transaction Created',
    ]);
    await vi.advanceTimersByTimeAsync(2_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(sending).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops resending once the waits would pass the 30 s budget', async () => {
    fetchMock.mockImplementation(async () => tooManyRequests(12));
    const telegramService = await loadTelegramService();

    const sending = telegramService.sendPlainMessagesWaitingOutRateLimits('chat-1', ['hi']);
    await vi.advanceTimersByTimeAsync(24_000);

    await expect(sending).resolves.toEqual([expect.objectContaining({ errorCode: 429 })]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('shares one wait budget across the messages of a batch', async () => {
    fetchMock
      .mockResolvedValueOnce(tooManyRequests(20))
      .mockResolvedValueOnce(sent())
      .mockResolvedValueOnce(tooManyRequests(20))
      .mockResolvedValueOnce(sent());
    const telegramService = await loadTelegramService();

    const sending = telegramService.sendPlainMessagesWaitingOutRateLimits('chat-1', [
      'part 1',
      'part 2',
    ]);
    await vi.advanceTimersByTimeAsync(20_000);

    await expect(sending).resolves.toEqual([expect.objectContaining({ errorCode: 429 })]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('still sends the later messages of a batch when one is refused', async () => {
    fetchMock.mockResolvedValueOnce(chatNotFound()).mockResolvedValueOnce(sent());
    const telegramService = await loadTelegramService();

    const failures = await telegramService.sendPlainMessagesWaitingOutRateLimits('chat-1', [
      'part 1',
      'part 2',
    ]);

    expect(failures).toEqual([expect.objectContaining({ errorCode: 400 })]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a wait longer than the budget', () => tooManyRequests(42), 429],
    ['a 429 that names no wait', () => telegramReply({ ok: false, error_code: 429 }), 429],
    ['a zero wait, which would never spend the budget', () => tooManyRequests(0), 429],
    ['an error other than a 429', chatNotFound, 400],
  ])('does not resend after %s', async (_case, reply, errorCode) => {
    fetchMock.mockImplementation(async () => reply());
    const telegramService = await loadTelegramService();

    const failures = await telegramService.sendPlainMessagesWaitingOutRateLimits('chat-1', ['hi']);

    expect(failures).toEqual([expect.objectContaining({ errorCode })]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never waits out a 429 on a single send, which a webhook reply uses', async () => {
    fetchMock.mockResolvedValue(tooManyRequests(1));
    const telegramService = await loadTelegramService();

    await expect(telegramService.sendPlainMessage('chat-1', 'hi')).rejects.toMatchObject({
      errorCode: 429,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
