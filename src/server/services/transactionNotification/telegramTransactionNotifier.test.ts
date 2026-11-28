import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendPlainMessagesWaitingOutRateLimits, sendMessage, getLinkedTelegramChatId } = vi.hoisted(
  () => ({
    sendPlainMessagesWaitingOutRateLimits: vi.fn(),
    sendMessage: vi.fn(),
    getLinkedTelegramChatId: vi.fn(),
  }),
);

vi.mock('@/server/services/telegramService', () => ({
  telegramService: { sendPlainMessagesWaitingOutRateLimits, sendMessage },
}));
vi.mock('@/server/services/userSettingsService', () => ({
  default: { getLinkedTelegramChatId },
}));
vi.mock('@/server/observability', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { TelegramTransactionNotifier } from '@/server/services/transactionNotification/telegramTransactionNotifier';
import type { Transaction } from '@/shared/types/transaction';

const telegramError = new Error('chat not found');
const TELEGRAM_MESSAGE_LIMIT = 4096;

function buildTransaction(index: number): Transaction {
  return {
    id: `tx-${index}`,
    description: `Merchant number ${index} with a fairly long statement description`,
    date: new Date('2026-11-27T00:00:00Z'),
    type: 'EXPENSE',
    status: 'APPROVED',
    category: { id: 'cat-food', name: 'Food' },
    value: index,
    currency: 'ILS',
    originalAmount: index,
    exchangeRate: null,
    exchangeRateDate: null,
    exchangeRateSource: null,
  };
}

const bulkImport = Array.from({ length: 106 }, (_, index) => buildTransaction(index + 1));

function sentMessages(): string[] {
  return sendPlainMessagesWaitingOutRateLimits.mock.calls.flatMap(([, messages]) => messages);
}

describe('TelegramTransactionNotifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLinkedTelegramChatId.mockResolvedValue('chat-1');
    sendPlainMessagesWaitingOutRateLimits.mockResolvedValue([]);
    sendMessage.mockRejectedValue(telegramError);
  });

  it('keeps the Telegram failure as the cause of a failed transaction notification', async () => {
    sendPlainMessagesWaitingOutRateLimits.mockResolvedValue([telegramError]);

    const notifying = new TelegramTransactionNotifier().notifyTransactionsCreated(
      [buildTransaction(1)],
      'user-1',
    );

    await expect(notifying).rejects.toThrow(/failedMessages: 1\/1/);
    await expect(notifying).rejects.toMatchObject({ cause: telegramError });
  });

  it('announces a single transaction on its own', async () => {
    await new TelegramTransactionNotifier().notifyTransactionsCreated(
      [buildTransaction(1)],
      'user-1',
    );

    expect(sendPlainMessagesWaitingOutRateLimits).toHaveBeenCalledTimes(1);
    expect(sendPlainMessagesWaitingOutRateLimits.mock.calls[0]).toEqual([
      'chat-1',
      [expect.stringMatching(/^Transaction Created\n📉 Merchant number 1 /)],
    ]);
  });

  it('sums up a bulk import in a few messages that still list every transaction', async () => {
    await new TelegramTransactionNotifier().notifyTransactionsCreated(bulkImport, 'user-1');

    expect(sendPlainMessagesWaitingOutRateLimits).toHaveBeenCalledTimes(1);
    const messages = sentMessages();
    expect(messages.length).toBeGreaterThan(1);
    expect(messages.length).toBeLessThan(10);
    messages.forEach((message, index) => {
      expect(message).toMatch(
        new RegExp(`^106 Transactions Created \\(${index + 1}/${messages.length}\\)\\n`),
      );
      expect(message.length).toBeLessThanOrEqual(TELEGRAM_MESSAGE_LIMIT);
    });
    const listed = messages.join('\n').match(/Merchant number \d+ /g);
    expect(listed).toEqual(
      bulkImport.map((transaction) => `Merchant number ${transaction.value} `),
    );
  });

  it('reports how many parts of a bulk import were refused', async () => {
    sendPlainMessagesWaitingOutRateLimits.mockResolvedValue([telegramError]);

    const notifying = new TelegramTransactionNotifier().notifyTransactionsCreated(
      bulkImport,
      'user-1',
    );

    await expect(notifying).rejects.toThrow(/failedMessages: 1\/[2-9] /);
  });

  it('cuts a transaction too long for one message instead of sending an empty part', async () => {
    const overlong = { ...buildTransaction(1), description: 'x'.repeat(5_000) };

    await new TelegramTransactionNotifier().notifyTransactionsCreated([overlong], 'user-1');

    const messages = sentMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(/^Transaction Created\n📉 x+…$/);
    expect(messages[0]?.length).toBeLessThanOrEqual(TELEGRAM_MESSAGE_LIMIT);
  });

  it('names the chat lookup, not a send, when the linked chat cannot be read', async () => {
    const readError = new Error('connection reset');
    getLinkedTelegramChatId.mockRejectedValue(readError);

    const notifying = new TelegramTransactionNotifier().notifyTransactionsCreated(
      [buildTransaction(1)],
      'user-1',
    );

    await expect(notifying).rejects.toThrow(
      /^Failed to read the linked Telegram chat, userId: user-1/,
    );
    await expect(notifying).rejects.toMatchObject({ cause: readError });
    expect(sendPlainMessagesWaitingOutRateLimits).not.toHaveBeenCalled();
  });

  it('keeps the Telegram failure as the cause of a failed daily summary', async () => {
    const sending = new TelegramTransactionNotifier().sendDailySummary('summary', 'user-1');

    await expect(sending).rejects.toThrow(/Failed to send daily summary, userId: user-1/);
    await expect(sending).rejects.toMatchObject({ cause: telegramError });
  });
});
