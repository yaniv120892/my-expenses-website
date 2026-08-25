import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Transaction, TransactionSummary } from '@/shared/types/transaction';

const { getAllCategories, getTransactions, getTransactionsSummary } =
  vi.hoisted(() => ({
    getAllCategories: vi.fn(),
    getTransactions: vi.fn(),
    getTransactionsSummary: vi.fn(),
  }));

vi.mock('@/server/repositories/categoryRepository', () => ({
  default: { getAllCategories },
}));
vi.mock('@/server/repositories/transactionRepository', () => ({
  default: { getTransactions, getTransactionsSummary },
}));

import { buildAssistantTools } from '@/server/services/assistant/tools';

const CONTEXT = {
  requestContext: { get: (key: string) => (key === 'userId' ? 'user-1' : '') },
};

type SummaryToolResult = {
  summary: string;
  transactionCount: number;
  resolvedCategory: string | null;
};

// Mastra's execute signature wants a full ToolExecutionContext, marks execute
// optional, and returns a validation union; the tools under test read only
// requestContext.get and always return the summary shape, so the bridge for
// all of that lives here, once.
async function invoke(
  tool: { execute?: (input: never, context: never) => unknown },
  input: unknown,
): Promise<SummaryToolResult> {
  if (!tool.execute) {
    throw new Error('tool has no execute');
  }
  return (await tool.execute(
    input as never,
    CONTEXT as never,
  )) as SummaryToolResult;
}

const CATEGORIES = [
  { id: 'c-food', name: 'Food & Groceries', parentId: null },
  { id: 'c-fast', name: 'Fast Food', parentId: 'c-food' },
  { id: 'c-rent', name: 'Rent', parentId: null },
];

function row(value: number): Transaction {
  return {
    id: `t-${value}`,
    description: 'Groceries',
    value,
    date: new Date('2026-03-15T12:00:00Z'),
    type: 'EXPENSE',
    status: 'APPROVED',
    category: { id: 'c-food', name: 'Food & Groceries' },
  };
}

function totals(overrides: Partial<TransactionSummary> = {}) {
  return {
    totalIncome: 0,
    totalExpense: 100,
    count: 1,
    incomeCount: 0,
    expenseCount: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getAllCategories.mockResolvedValue(CATEGORIES);
  getTransactions.mockResolvedValue([row(100)]);
  getTransactionsSummary.mockResolvedValue(totals());
});

const tools = buildAssistantTools();

describe('category resolution', () => {
  it('rejects an unknown name instead of silently dropping the filter', async () => {
    await expect(
      invoke(tools.summarizeTransactions, {
        categoryName: 'Utilities',
        aggregation: 'total',
      }),
    ).rejects.toThrow(/Unknown category "Utilities".*listCategories/);
    // The failure must happen before any figures are computed.
    expect(getTransactionsSummary).not.toHaveBeenCalled();
  });

  it('rejects an ambiguous name and lists the near matches', async () => {
    await expect(
      invoke(tools.summarizeTransactions, {
        categoryName: 'Food',
        aggregation: 'total',
      }),
    ).rejects.toThrow(/ambiguous.*Food & Groceries, Fast Food/);
  });

  it('resolves a unique partial match to its whole subtree', async () => {
    const result = await invoke(tools.summarizeTransactions, {
      categoryName: 'groceries',
      aggregation: 'total',
    });

    expect(result.resolvedCategory).toBe('Food & Groceries');
    // Fast Food is a child of Food & Groceries, so the figures cover it too,
    // matching how the transactions list expands a parent category.
    expect(getTransactionsSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        categoryIds: ['c-food', 'c-fast'],
      }),
    );
  });

  it('reports null resolvedCategory when no filter was asked for', async () => {
    const result = await invoke(tools.summarizeTransactions, {
      aggregation: 'total',
    });

    expect(result.resolvedCategory).toBeNull();
  });
});

describe('aggregation paths', () => {
  it('answers totals from the SQL summary without loading rows', async () => {
    getTransactionsSummary.mockResolvedValue(
      totals({ totalExpense: 123456.78, count: 9999 }),
    );

    const result = await invoke(tools.summarizeTransactions, {
      aggregation: 'total',
    });

    expect(result.summary).toContain('123,456.78');
    expect(result.transactionCount).toBe(9999);
    expect(getTransactions).not.toHaveBeenCalled();
  });

  it('marks row-level results as partial when the read cap was hit', async () => {
    getTransactions.mockResolvedValue(
      Array.from({ length: 5000 }, (_, index) => row(index + 1)),
    );
    getTransactionsSummary.mockResolvedValue(totals({ count: 7000 }));

    const result = await invoke(tools.summarizeTransactions, {
      aggregation: 'breakdown_by_category',
    });

    expect(result.summary).toContain('newest 5000 of 7000 matching');
    expect(result.summary).toContain('partial');
  });

  it('skips the count query and the note when the page came back short', async () => {
    getTransactions.mockResolvedValue([row(100), row(200)]);

    const result = await invoke(tools.summarizeTransactions, {
      aggregation: 'breakdown_by_category',
    });

    expect(result.summary).not.toContain('partial');
    expect(getTransactionsSummary).not.toHaveBeenCalled();
  });
});

describe('comparePeriods', () => {
  it('compares SQL totals rather than loaded rows', async () => {
    getTransactionsSummary
      .mockResolvedValueOnce(totals({ totalExpense: 1000, count: 10 }))
      .mockResolvedValueOnce(totals({ totalExpense: 1500, count: 12 }));

    const result = await invoke(tools.comparePeriods, {
      periodA: {
        label: 'Jan',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      },
      periodB: {
        label: 'Feb',
        startDate: '2026-02-01',
        endDate: '2026-02-28',
      },
    });

    expect(result.summary).toContain('Difference: +500.00');
    expect(result.summary).toContain('Percentage change: +50%');
    expect(getTransactions).not.toHaveBeenCalled();
  });
});
