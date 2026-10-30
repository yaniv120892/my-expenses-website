import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getAllTransactions, findReportRecipients, sendDailySummary } = vi.hoisted(() => ({
  getAllTransactions: vi.fn(),
  findReportRecipients: vi.fn(),
  sendDailySummary: vi.fn(),
}));

vi.mock('@/server/services/transactionService', () => ({
  default: { getAllTransactions },
}));
vi.mock('@/server/repositories/userRepository', () => ({
  default: { findReportRecipients },
}));
vi.mock('@/server/services/transactionNotification/transactionNotifierFactory', () => ({
  default: { getNotifier: () => ({ sendDailySummary }) },
}));

import summaryService from '@/server/services/summaryService';
import { formatSummaryMessage } from '@/server/utils/summaryMessage';
import { toHouseholdId } from '@/server/auth/householdId';

const HOUSEHOLD_ID = toHouseholdId('household-1');

describe('getTodayTransactions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T21:00:00'));
    getAllTransactions.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes today for both bounds and lets the repository own the edges', async () => {
    await summaryService['getTodayTransactions'](HOUSEHOLD_ID);

    const [householdId, query] = getAllTransactions.mock.calls[0] ?? [];
    expect(householdId).toBe(HOUSEHOLD_ID);
    const { startDate, endDate } = query;
    expect(startDate).toEqual(new Date('2026-08-25T21:00:00'));
    expect(endDate).toEqual(new Date('2026-08-25T21:00:00'));
  });

  it('asks for expenses only, since the message lists and totals them as expenses', async () => {
    await summaryService['getTodayTransactions'](HOUSEHOLD_ID);

    expect(getAllTransactions.mock.calls[0]?.[1]).toMatchObject({
      transactionType: 'EXPENSE',
    });
  });
});

describe('sendTodaySummaryToAllUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllTransactions.mockResolvedValue([]);
  });

  it("sends each member their own household's summary, built once per household", async () => {
    const otherHousehold = toHouseholdId('household-2');
    findReportRecipients.mockResolvedValue([
      { userId: 'user-1', householdId: HOUSEHOLD_ID },
      { userId: 'user-2', householdId: HOUSEHOLD_ID },
      { userId: 'user-3', householdId: otherHousehold },
    ]);

    await summaryService.sendTodaySummaryToAllUsers();

    expect(findReportRecipients).toHaveBeenCalledWith('dailySummary');
    expect(getAllTransactions.mock.calls.map(([householdId]) => householdId)).toEqual([
      HOUSEHOLD_ID,
      otherHousehold,
    ]);
    expect(sendDailySummary.mock.calls.map(([, userId]) => userId)).toEqual([
      'user-1',
      'user-2',
      'user-3',
    ]);
  });
});

describe('formatSummaryMessage', () => {
  it('escapes Markdown entities in user text but keeps its own bold markers', () => {
    const message = formatSummaryMessage(
      [
        {
          category: { name: 'Food_Delivery' },
          description: 'Pizza *Roma* [deal]',
          value: 42,
        },
      ],
      42,
      'insights',
    );

    expect(message).toContain('Food\\_Delivery');
    expect(message).toContain('Pizza \\*Roma\\* \\[deal]');
    expect(message).toContain('*ההוצאות של היום:*');
  });

  it('escapes the model-written insights too', () => {
    const message = formatSummaryMessage([], 0, 'you spent *a lot_');

    expect(message).toContain('you spent \\*a lot\\_');
  });

  it('drops the summary section when the provider returned nothing', () => {
    const message = formatSummaryMessage(
      [{ category: { name: 'Food' }, description: 'Pizza', value: 42 }],
      42,
      null,
    );

    expect(message).not.toContain('*סיכום:*');
    expect(message).toContain('*סך הכל הוצאות:*');
    // The apology the provider used to return would have been escaped and sent.
    expect(message).not.toMatch(/I encountered/);
  });
});
