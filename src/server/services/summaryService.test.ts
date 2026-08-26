import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getAllTransactions } = vi.hoisted(() => ({
  getAllTransactions: vi.fn(),
}));

vi.mock('@/server/services/transactionService', () => ({
  default: { getAllTransactions },
}));

import summaryService from '@/server/services/summaryService';
import { formatSummaryMessage } from '@/server/utils/summaryMessage';

// The window computation is private; reaching it directly keeps the test off
// the AI and notifier plumbing, following the transactionService.test.ts
// precedent for private access.
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

  it('passes today for both bounds and lets the repository own the edges', async () => {
    await service.getTodayTransactions('user-1');

    const { startDate, endDate } = getAllTransactions.mock.calls[0][0];
    expect(startDate).toEqual(new Date('2026-08-25T21:00:00'));
    expect(endDate).toEqual(new Date('2026-08-25T21:00:00'));
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
