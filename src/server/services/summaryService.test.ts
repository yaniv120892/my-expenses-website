import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getAllTransactions, findHouseholdId } = vi.hoisted(() => ({
  getAllTransactions: vi.fn(),
  findHouseholdId: vi.fn(),
}));

vi.mock('@/server/services/transactionService', () => ({
  default: { getAllTransactions },
}));
vi.mock('@/server/repositories/userRepository', () => ({
  default: { findHouseholdId },
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

describe('getTodaySummaryMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllTransactions.mockResolvedValue([]);
  });

  it("reads today's expenses of the household the user belongs to", async () => {
    findHouseholdId.mockResolvedValue(HOUSEHOLD_ID);

    await expect(summaryService['getTodaySummaryMessage']('user-1')).resolves.toBe(
      'לא נוספו הוצאות היום.',
    );

    expect(findHouseholdId).toHaveBeenCalledWith('user-1');
    expect(getAllTransactions).toHaveBeenCalledWith(HOUSEHOLD_ID, expect.any(Object));
  });

  it('refuses a user with no household instead of summarizing nothing', async () => {
    findHouseholdId.mockResolvedValue(null);

    await expect(summaryService['getTodaySummaryMessage']('user-1')).rejects.toThrow(
      'No household for user user-1',
    );
    expect(getAllTransactions).not.toHaveBeenCalled();
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
