import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  exportTransactionsSchema,
  getTransactionsSchema,
  getTransactionsSummarySchema,
} from '@/shared/schemas/transactions';

const get = vi.fn();
vi.mock('./api', () => ({
  default: { get: (...args: unknown[]) => get(...args) },
}));

const { getTransactionsPage, getTransactionSummary, exportTransactionsCsv } =
  await import('./transactions');

/** Query params reach the route as strings, so mirror that before validating. */
function asQueryString(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
}

function sentParams(): Record<string, unknown> {
  return get.mock.calls[0][1].params;
}

describe('getTransactionsPage', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: { items: [], nextCursor: null } });
  });

  // Regression: the client used to hardcode perPage=1000, which the route's
  // schema rejects with a 400, so the list rendered its error state.
  it('sends params the route schema accepts', async () => {
    await getTransactionsPage({
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });

    const result = getTransactionsSchema.safeParse(asQueryString(sentParams()));
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  it('requests one page instead of walking every page', async () => {
    await getTransactionsPage({ startDate: '2026-08-01' });

    expect(get).toHaveBeenCalledTimes(1);
    expect(sentParams().limit).toBe(50);
  });

  it('forwards the cursor for the next page', async () => {
    await getTransactionsPage({ startDate: '2026-08-01' }, 'cursor-token');

    expect(sentParams().cursor).toBe('cursor-token');
  });

  it('keeps a caller endDate over the default', async () => {
    await getTransactionsPage({ endDate: '2026-08-31' });

    expect(sentParams().endDate).toBe('2026-08-31');
  });
});

describe('getTransactionSummary', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({
      data: { totalIncome: 0, totalExpense: 0, count: 0 },
    });
  });

  it('sends params the summary route schema accepts', async () => {
    await getTransactionSummary({
      startDate: '2026-08-01',
      searchTerm: 'taxi',
    });

    const result = getTransactionsSummarySchema.safeParse(
      asQueryString(sentParams()),
    );
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    expect(sentParams().searchTerm).toBe('taxi');
  });
});

describe('exportTransactionsCsv', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({
      data: new Blob(['csv']),
      headers: {
        'content-disposition':
          'attachment; filename="transactions_2026-08-01_2026-08-31.csv"',
      },
    });
  });

  it('sends params the export route schema accepts', async () => {
    await exportTransactionsCsv({ startDate: '2026-08-01', type: 'EXPENSE' });

    const result = exportTransactionsSchema.safeParse(
      asQueryString(sentParams()),
    );
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    expect(sentParams().type).toBe('EXPENSE');
  });

  it('asks for a blob so the CSV is not parsed as JSON', async () => {
    await exportTransactionsCsv({ startDate: '2026-08-01' });

    expect(get.mock.calls[0][1].responseType).toBe('blob');
  });

  it('saves under the name the route chose', async () => {
    const { fileName } = await exportTransactionsCsv({});

    expect(fileName).toBe('transactions_2026-08-01_2026-08-31.csv');
  });
});

// The totals sit above the list and the export sits beside it, so any filter
// that narrows the rows must narrow all three — including the default endDate
// the client injects.
describe('list, summary and export filters', () => {
  beforeEach(() => get.mockReset());

  it('describe the same rows', async () => {
    get.mockResolvedValue({ data: { items: [], nextCursor: null } });
    await getTransactionsPage({ searchTerm: 'taxi', categoryId: 'cat-1' });
    const listParams = sentParams();

    get.mockReset();
    get.mockResolvedValue({
      data: { totalIncome: 0, totalExpense: 0, count: 0 },
    });
    await getTransactionSummary({ searchTerm: 'taxi', categoryId: 'cat-1' });
    const summaryParams = sentParams();

    get.mockReset();
    get.mockResolvedValue({ data: new Blob(['csv']), headers: {} });
    await exportTransactionsCsv({ searchTerm: 'taxi', categoryId: 'cat-1' });
    const exportParams = sentParams();

    const { cursor: _cursor, limit: _limit, ...listFilters } = listParams;
    expect(summaryParams).toEqual(listFilters);
    expect(exportParams).toEqual(listFilters);
  });
});
