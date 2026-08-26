import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMessage, incrementWithTtl, loggerError } = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  incrementWithTtl: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/server/services/telegramService', async (importOriginal) => ({
  // The real escapeMarkdown stays live: these tests assert escaping.
  ...(await importOriginal<object>()),
  telegramService: { sendMessage },
}));
vi.mock('@/server/redis', () => ({ incrementWithTtl }));
vi.mock('@/server/logging/logger', () => ({
  default: { error: loggerError, warn: vi.fn(), info: vi.fn() },
}));

import { notifyOpsAlert } from '@/server/services/alertService';

const CHAT_ID = 'ops-chat-1';

function sentMessages(): string[] {
  return sendMessage.mock.calls.map((call) => call[1] as string);
}

describe('notifyOpsAlert', () => {
  beforeEach(() => {
    process.env.TELEGRAM_ALERT_CHAT_ID = CHAT_ID;
    sendMessage.mockReset();
    sendMessage.mockResolvedValue(undefined);
    incrementWithTtl.mockReset();
    incrementWithTtl.mockResolvedValue(1);
    loggerError.mockReset();
  });

  it('stays entirely off when TELEGRAM_ALERT_CHAT_ID is unset', async () => {
    delete process.env.TELEGRAM_ALERT_CHAT_ID;

    await notifyOpsAlert({
      alertType: '5xx GET /api/transactions',
      title: '5xx on GET /api/transactions',
    });

    expect(incrementWithTtl).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('sends the title, error message and context to the ops chat', async () => {
    await notifyOpsAlert({
      alertType: '5xx GET /api/transactions',
      title: '5xx on GET /api/transactions',
      err: new Error('Database unreachable'),
      context: { requestId: 'req-1', userId: 'user-1', missing: undefined },
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const [chatId, message] = sendMessage.mock.calls[0];
    expect(chatId).toBe(CHAT_ID);
    expect(message).toBe(
      [
        '🚨 *5xx on GET /api/transactions*',
        'Database unreachable',
        'requestId: req-1',
        'userId: user-1',
      ].join('\n'),
    );
  });

  it('escapes Markdown so Telegram cannot reject the send', async () => {
    await notifyOpsAlert({
      alertType: 'import-failure',
      title: 'Import *failed*',
      err: new Error('bad token `abc` in _field_ [row 3]'),
      context: { path: '/api/imports/[id]' },
    });

    expect(sentMessages()[0]).toBe(
      [
        '🚨 *Import \\*failed\\**',
        'bad token \\`abc\\` in \\_field\\_ \\[row 3]',
        'path: /api/imports/\\[id]',
      ].join('\n'),
    );
  });

  it('keys the hourly quota by alert type, not the display title', async () => {
    await notifyOpsAlert({
      alertType: '5xx GET /api/transactions',
      title: '5xx on GET /api/transactions',
    });

    expect(incrementWithTtl).toHaveBeenCalledWith(
      'ops-alert:5xx-get-api-transactions',
      3600,
    );
  });

  it('shares one quota across records on the same route pattern', async () => {
    await notifyOpsAlert({
      alertType: '5xx GET /api/transactions/[id]',
      title: '5xx on GET /api/transactions/abc-123',
    });
    await notifyOpsAlert({
      alertType: '5xx GET /api/transactions/[id]',
      title: '5xx on GET /api/transactions/def-456',
    });

    const keys = incrementWithTtl.mock.calls.map((call) => call[0]);
    expect(new Set(keys).size).toBe(1);
  });

  it('suppresses past the cap and says so exactly once', async () => {
    for (let count = 1; count <= 8; count += 1) {
      incrementWithTtl.mockResolvedValueOnce(count);
      await notifyOpsAlert({
        alertType: 'flood',
        title: 'flood',
        err: new Error(`hit ${count}`),
      });
    }

    const messages = sentMessages();
    expect(messages).toHaveLength(6);
    expect(messages.slice(0, 5).map((line) => line.split('\n')[1])).toEqual([
      'hit 1',
      'hit 2',
      'hit 3',
      'hit 4',
      'hit 5',
    ]);
    expect(messages[5]).toContain('🔇 *Ops alerts suppressed*');
    expect(messages[5]).toContain('More than 5 "flood" alerts this hour.');
  });

  it('swallows and logs a failing sendMessage', async () => {
    sendMessage.mockRejectedValue(new Error('chat not found'));

    await expect(
      notifyOpsAlert({
        alertType: 'boom',
        title: 'boom',
        err: new Error('original'),
      }),
    ).resolves.toBeUndefined();
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'boom' }),
      'Failed to send ops alert',
    );
  });

  it('sends nothing when the rate-limit check itself fails', async () => {
    incrementWithTtl.mockRejectedValue(new Error('redis down'));

    await expect(
      notifyOpsAlert({ alertType: 'boom', title: 'boom' }),
    ).resolves.toBeUndefined();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(loggerError).toHaveBeenCalledTimes(1);
  });
});
