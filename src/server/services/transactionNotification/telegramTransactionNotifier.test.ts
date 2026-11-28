import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendPlainMessageWaitingOutRateLimits, sendMessage, getLinkedTelegramChatId } = vi.hoisted(
  () => ({
    sendPlainMessageWaitingOutRateLimits: vi.fn(),
    sendMessage: vi.fn(),
    getLinkedTelegramChatId: vi.fn(),
  }),
);

vi.mock('@/server/services/telegramService', () => ({
  telegramService: { sendPlainMessageWaitingOutRateLimits, sendMessage },
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

describe('TelegramTransactionNotifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLinkedTelegramChatId.mockResolvedValue('chat-1');
    sendPlainMessageWaitingOutRateLimits.mockRejectedValue(telegramError);
    sendMessage.mockRejectedValue(telegramError);
  });

  it('keeps the Telegram failure as the cause of a failed transaction notification', async () => {
    const notifying = new TelegramTransactionNotifier().notifyTransactionsCreated(
      [buildTransaction(1)],
      'user-1',
    );

    await expect(notifying).rejects.toMatchObject({ cause: telegramError });
  });

  it('announces a single transaction on its own', async () => {
    sendPlainMessageWaitingOutRateLimits.mockResolvedValue(undefined);

    await new TelegramTransactionNotifier().notifyTransactionsCreated(
      [buildTransaction(1)],
      'user-1',
    );

    expect(sendPlainMessageWaitingOutRateLimits).toHaveBeenCalledTimes(1);
    expect(sendPlainMessageWaitingOutRateLimits.mock.calls[0]).toEqual([
      'chat-1',
      expect.stringMatching(/^Transaction Created\n📉 Merchant number 1 /),
    ]);
  });

  it('sums up a bulk import in a few messages that still list every transaction', async () => {
    sendPlainMessageWaitingOutRateLimits.mockResolvedValue(undefined);
    const transactions = Array.from({ length: 106 }, (_, index) => buildTransaction(index + 1));

    await new TelegramTransactionNotifier().notifyTransactionsCreated(transactions, 'user-1');

    const messages: string[] = sendPlainMessageWaitingOutRateLimits.mock.calls.map(
      ([, message]) => message,
    );
    expect(messages.length).toBeLessThan(10);
    expect(messages.length).toBeGreaterThan(1);
    messages.forEach((message, index) => {
      expect(message).toMatch(
        new RegExp(`^106 Transactions Created \\(${index + 1}/${messages.length}\\)\\n`),
      );
    });
    for (const message of messages) {
      expect(message.length).toBeLessThanOrEqual(TELEGRAM_MESSAGE_LIMIT);
    }
    const listed = messages.join('\n').match(/Merchant number \d+ /g);
    expect(listed).toEqual(
      transactions.map((transaction) => `Merchant number ${transaction.value} `),
    );
  });

  it('still sends the later parts of a bulk import when one part is refused', async () => {
    sendPlainMessageWaitingOutRateLimits.mockResolvedValue(undefined);
    sendPlainMessageWaitingOutRateLimits.mockRejectedValueOnce(telegramError);
    const transactions = Array.from({ length: 106 }, (_, index) => buildTransaction(index + 1));

    const notifying = new TelegramTransactionNotifier().notifyTransactionsCreated(
      transactions,
      'user-1',
    );

    await expect(notifying).rejects.toThrow(/failedMessages: 1\/[2-9]/);
    const lastPart: string = sendPlainMessageWaitingOutRateLimits.mock.lastCall?.[1];
    expect(lastPart).toContain('Merchant number 106 ');
  });

  it('keeps the Telegram failure as the cause of a failed daily summary', async () => {
    const sending = new TelegramTransactionNotifier().sendDailySummary('summary', 'user-1');

    await expect(sending).rejects.toThrow(/Failed to send daily summary, userId: user-1/);
    await expect(sending).rejects.toMatchObject({ cause: telegramError });
  });
});
