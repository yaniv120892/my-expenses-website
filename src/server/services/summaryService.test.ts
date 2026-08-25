import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getAllTransactions } = vi.hoisted(() => ({
  getAllTransactions: vi.fn(),
}));

vi.mock('@/server/services/transactionService', () => ({
  default: { getAllTransactions },
}));

import summaryService from '@/server/services/summaryService';

// The window and message builders are private; reaching them directly keeps
// the tests off the AI and notifier plumbing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = summaryService as any;

describe('getTodayTransactions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T21:00:00'));
    getAllTransactions.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('bounds the window to today, not tomorrow', async () => {
    await service.getTodayTransactions('user-1');

    const { startDate, endDate } = getAllTransactions.mock.calls[0][0];
    // The repository normalizes both bounds to the day's edges.
    expect(startDate).toEqual(new Date('2026-08-25T21:00:00'));
    expect(endDate).toEqual(new Date('2026-08-25T21:00:00'));
  });
});

describe('formatSummaryMessage', () => {
  it('escapes Markdown entities in user text but keeps its own bold markers', () => {
    const message = service.formatSummaryMessage(
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
    // The template's own headers stay real Markdown.
    expect(message).toContain('*ההוצאות של היום:*');
  });
});
