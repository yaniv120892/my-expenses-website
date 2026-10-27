import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendPlainMessage, sendMessage, getLinkedTelegramChatId } = vi.hoisted(() => ({
  sendPlainMessage: vi.fn(),
  sendMessage: vi.fn(),
  getLinkedTelegramChatId: vi.fn(),
}));

vi.mock('@/server/services/telegramService', () => ({
  telegramService: { sendPlainMessage, sendMessage },
}));
vi.mock('@/server/services/userSettingsService', () => ({
  default: { getLinkedTelegramChatId },
}));
vi.mock('@/server/utils/transactionUtils', () => ({
  formatTransaction: () => 'formatted',
}));
vi.mock('@/server/logging/logger', () => ({
  default: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { TelegramTransactionNotifier } from '@/server/services/transactionNotification/telegramTransactionNotifier';
import type { Transaction } from '@/shared/types/transaction';

const telegramError = new Error('chat not found');

describe('TelegramTransactionNotifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLinkedTelegramChatId.mockResolvedValue('chat-1');
    sendPlainMessage.mockRejectedValue(telegramError);
    sendMessage.mockRejectedValue(telegramError);
  });

  it('keeps the Telegram failure as the cause of a failed transaction notification', async () => {
    const transaction: Transaction = {
      id: 'tx-1',
      description: 'Coffee',
      date: new Date('2026-03-01T00:00:00Z'),
      type: 'EXPENSE',
      status: 'APPROVED',
      category: { id: 'cat-food', name: 'Food' },
      value: 12,
      currency: 'ILS',
      originalAmount: 12,
      exchangeRate: null,
      exchangeRateDate: null,
      exchangeRateSource: null,
    };
    const notifying = new TelegramTransactionNotifier().notifyTransactionCreated(
      transaction,
      'user-1',
    );

    await expect(notifying).rejects.toMatchObject({ cause: telegramError });
  });

  it('keeps the Telegram failure as the cause of a failed daily summary', async () => {
    const sending = new TelegramTransactionNotifier().sendDailySummary('summary', 'user-1');

    await expect(sending).rejects.toThrow(/Failed to send daily summary, userId: user-1/);
    await expect(sending).rejects.toMatchObject({ cause: telegramError });
  });
});
