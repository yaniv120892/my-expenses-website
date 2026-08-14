import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTransactionsSchema } from '@/shared/schemas/transactions';

const get = vi.fn();
vi.mock('./api', () => ({
  default: { get: (...args: unknown[]) => get(...args) },
}));

const { getTransactions } = await import('./transactions');

/** Query params reach the route as strings, so mirror that before validating. */
function asQueryString(params: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  );
}

function sentParams(): Record<string, unknown>[] {
  return get.mock.calls.map((call) => call[1].params);
}

function page(rows: number) {
  return { data: Array.from({ length: rows }, (_, i) => ({ id: `tx-${i}` })) };
}

describe('getTransactions', () => {
  beforeEach(() => get.mockReset());

  // Regression: the client used to hardcode perPage=1000, which the route's
  // schema rejects with a 400, so the list rendered its error state.
  it('sends params the route schema accepts', async () => {
    get.mockResolvedValue(page(0));

    await getTransactions({ startDate: '2026-08-01', endDate: '2026-08-31' });

    expect(sentParams()).toHaveLength(1);
    for (const params of sentParams()) {
      const result = getTransactionsSchema.safeParse(asQueryString(params));
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
    }
  });

  it('walks pages until a short page and concatenates them', async () => {
    get
      .mockResolvedValueOnce(page(100))
      .mockResolvedValueOnce(page(100))
      .mockResolvedValueOnce(page(7));

    const transactions = await getTransactions({ startDate: '2026-08-01' });

    expect(transactions).toHaveLength(207);
    expect(sentParams().map((p) => p.page)).toEqual([1, 2, 3]);
    for (const params of sentParams()) {
      expect(
        getTransactionsSchema.safeParse(asQueryString(params)).success,
      ).toBe(true);
    }
  });

  it('fetches a single page when the caller asks for one', async () => {
    get.mockResolvedValue(page(100));

    await getTransactions({ page: 2, perPage: 50 });

    expect(sentParams()).toEqual([
      expect.objectContaining({ page: 2, perPage: 50 }),
    ]);
  });

  it('clamps an over-cap perPage instead of letting the route reject it', async () => {
    get.mockResolvedValue(page(0));

    await getTransactions({ page: 1, perPage: 1000 });

    expect(sentParams()[0].perPage).toBe(100);
  });

  it('keeps a caller endDate over the default', async () => {
    get.mockResolvedValue(page(0));

    await getTransactions({ endDate: '2026-08-31' });

    expect(sentParams()[0].endDate).toBe('2026-08-31');
  });
});
