// zod/v4 rather than the root export: the root is v3, which routes Mastra
// through a zod-v3 adapter with a broken CommonJS interop; the v4 adapter
// uses zod's own toJSONSchema and works.
import { z } from 'zod/v4';
import { createTool } from '@mastra/core/tools';
import transactionRepository from '@/server/repositories/transactionRepository';
import categoryRepository from '@/server/repositories/categoryRepository';
import trendService from '@/server/services/trendService';
import chatAggregationService from '@/server/services/chatAggregationService';
import { formatCurrencyPlain } from '@/utils/format';
import { Transaction, TransactionSummary } from '@/shared/types/transaction';
import { AggregationType, TotalsAggregationType } from '@/shared/types/chat';
import { TREND_PERIODS } from '@/shared/types/trends';

export const USER_ID_CONTEXT_KEY = 'userId';

// Row-level aggregations (lists, breakdowns, min/max) read at most this many
// rows; when more match, the result carries an explicit partial-data note.
// Totals, counts and averages never hit the cap — they are computed in SQL.
const MAX_TRANSACTIONS = 5000;

/**
 * The user id is never part of a tool's inputSchema — it is injected
 * server-side through the request context, so a prompt-injected message
 * cannot read another user's transactions.
 */
function requireUserId(context: {
  requestContext?: { get: (key: string) => unknown };
}): string {
  const userId = context.requestContext?.get(USER_ID_CONTEXT_KEY);

  if (typeof userId !== 'string' || !userId) {
    throw new Error('Assistant tool called without an authenticated user');
  }

  return userId;
}

const dateFilterSchema = z.object({
  startDate: z
    .string()
    .optional()
    .describe('Inclusive start date in YYYY-MM-DD format'),
  endDate: z
    .string()
    .optional()
    .describe('Inclusive end date in YYYY-MM-DD format'),
  categoryName: z
    .string()
    .optional()
    .describe('Category name, as returned by listCategories'),
  transactionType: z
    .enum(['INCOME', 'EXPENSE'])
    .optional()
    .describe('Restrict to income or expenses'),
  searchTerm: z
    .string()
    .optional()
    .describe('Free-text term matched against the transaction description'),
});

type DateFilterInput = z.infer<typeof dateFilterSchema> & {
  categoryId?: string;
};

const summaryOutputSchema = z.object({
  summary: z.string(),
  transactionCount: z.number(),
  resolvedCategory: z
    .string()
    .nullable()
    .describe(
      'The category the figures actually cover, or null when unfiltered',
    ),
});

const periodSchema = (exampleLabel: string) =>
  z.object({
    label: z.string().describe(`Short human label, e.g. "${exampleLabel}"`),
    startDate: z.string().describe('Inclusive start date, YYYY-MM-DD'),
    endDate: z.string().describe('Inclusive end date, YYYY-MM-DD'),
  });

type ResolvedCategory = { id: string; name: string };

/**
 * A name that resolves to nothing or to several categories is a tool error,
 * never a silently dropped or arbitrarily chosen filter — the earlier
 * behaviour answered "how much on Groceries?" with the total across every
 * category. The error text is model-facing: it lists the near matches so the
 * model can retry with an exact name.
 */
async function resolveCategory(
  categoryName?: string,
): Promise<ResolvedCategory | undefined> {
  if (!categoryName) {
    return undefined;
  }

  const categories = await categoryRepository.getAllCategories();
  const lowerName = categoryName.toLowerCase();

  const exact = categories.find(
    (category) => category.name.toLowerCase() === lowerName,
  );
  if (exact) {
    return { id: exact.id, name: exact.name };
  }

  const partials = categories.filter(
    (category) =>
      category.name.toLowerCase().includes(lowerName) ||
      lowerName.includes(category.name.toLowerCase()),
  );
  if (partials.length === 1) {
    return { id: partials[0].id, name: partials[0].name };
  }

  const nearMatches = partials.map((category) => category.name);
  throw new Error(
    nearMatches.length
      ? `Category "${categoryName}" is ambiguous. Close matches: ${nearMatches.join(', ')}. Retry with one exact name.`
      : `Unknown category "${categoryName}". Call listCategories and retry with an exact name from the list.`,
  );
}

function isTotalsAggregation(
  aggregation: AggregationType,
): aggregation is TotalsAggregationType {
  switch (aggregation) {
    case 'total':
    case 'average':
    case 'count':
      return true;
    default:
      return false;
  }
}

async function summarize(
  userId: string,
  filters: DateFilterInput,
  aggregation: AggregationType,
): Promise<{
  summary: string;
  transactionCount: number;
  resolvedCategory: string | null;
}> {
  const category = await resolveCategory(filters.categoryName);
  const scoped = { ...filters, categoryId: filters.categoryId ?? category?.id };

  const result = isTotalsAggregation(aggregation)
    ? chatAggregationService.aggregateFromTotals(
        await fetchTotals(userId, scoped),
        aggregation,
      )
    : await aggregateRows(userId, scoped, aggregation);

  return {
    summary: result.summary,
    transactionCount: result.transactionCount,
    resolvedCategory: category?.name ?? null,
  };
}

async function aggregateRows(
  userId: string,
  filters: DateFilterInput,
  aggregation: AggregationType,
): Promise<{ summary: string; transactionCount: number }> {
  const [transactions, totals] = await Promise.all([
    fetchTransactions(userId, filters),
    fetchTotals(userId, filters),
  ]);
  const result = chatAggregationService.aggregate(transactions, aggregation);
  if (totals.count <= transactions.length) {
    return result;
  }
  return {
    ...result,
    summary: `${result.summary}\n\nNote: computed from the newest ${transactions.length} of ${totals.count} matching transactions — report these figures as partial.`,
  };
}

function toRepositoryFilters(userId: string, filters: DateFilterInput) {
  return {
    userId,
    ...(filters.startDate ? { startDate: new Date(filters.startDate) } : {}),
    ...(filters.endDate ? { endDate: new Date(filters.endDate) } : {}),
    ...(filters.transactionType
      ? { transactionType: filters.transactionType }
      : {}),
    ...(filters.searchTerm ? { searchTerm: filters.searchTerm } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
  };
}

async function fetchTotals(
  userId: string,
  filters: DateFilterInput,
): Promise<TransactionSummary> {
  return transactionRepository.getTransactionsSummary(
    toRepositoryFilters(userId, filters),
  );
}

async function fetchTransactions(
  userId: string,
  filters: DateFilterInput,
): Promise<Transaction[]> {
  return transactionRepository.getTransactions({
    ...toRepositoryFilters(userId, filters),
    page: 1,
    perPage: MAX_TRANSACTIONS,
  });
}

export function buildAssistantTools() {
  const listCategories = createTool({
    id: 'listCategories',
    description:
      'Lists every category available to the user. Call this before filtering by category so you use a real category name rather than guessing one.',
    inputSchema: z.object({}),
    outputSchema: z.object({
      categories: z.array(z.string()),
    }),
    execute: async (_input, context) => {
      requireUserId(context);
      const categories = await categoryRepository.getAllCategories();
      return { categories: categories.map((category) => category.name) };
    },
  });

  const listTransactions = createTool({
    id: 'listTransactions',
    description:
      'Lists individual transactions matching the given filters. Use this when the user wants to see specific transactions rather than a total.',
    inputSchema: dateFilterSchema,
    outputSchema: summaryOutputSchema,
    execute: async (input, context) =>
      summarize(requireUserId(context), input, 'list'),
  });

  const summarizeTransactions = createTool({
    id: 'summarizeTransactions',
    description:
      'Computes a figure over the transactions matching the filters — a total, average, count, category breakdown, monthly breakdown, or highest/lowest. All arithmetic is done server-side; use the returned numbers exactly as given.',
    inputSchema: dateFilterSchema.extend({
      aggregation: z
        .enum([
          'total',
          'average',
          'count',
          'breakdown_by_category',
          'breakdown_by_month',
          'min_max',
        ])
        .describe('Which figure to compute'),
    }),
    outputSchema: summaryOutputSchema,
    execute: async (input, context) =>
      summarize(requireUserId(context), input, input.aggregation),
  });

  const comparePeriods = createTool({
    id: 'comparePeriods',
    description:
      'Compares two date ranges and returns both totals along with the difference and percentage change, all computed server-side. Always use this for comparisons instead of calling summarizeTransactions twice and subtracting the results yourself.',
    inputSchema: z.object({
      periodA: periodSchema('January 2026'),
      periodB: periodSchema('February 2026'),
      categoryName: z
        .string()
        .optional()
        .describe('Restrict both periods to this category'),
      transactionType: z
        .enum(['INCOME', 'EXPENSE'])
        .optional()
        .describe('Restrict both periods to income or expenses'),
    }),
    outputSchema: summaryOutputSchema,
    execute: async (input, context) => {
      const userId = requireUserId(context);

      // Resolved once and shared so each period does not re-fetch the
      // category list to map the same name.
      const category = await resolveCategory(input.categoryName);
      const shared: DateFilterInput = {
        categoryId: category?.id,
        transactionType: input.transactionType,
      };

      // SQL totals rather than loaded rows, so the comparison stays exact
      // however many transactions each period holds.
      const [totalsA, totalsB] = await Promise.all([
        fetchTotals(userId, {
          ...shared,
          startDate: input.periodA.startDate,
          endDate: input.periodA.endDate,
        }),
        fetchTotals(userId, {
          ...shared,
          startDate: input.periodB.startDate,
          endDate: input.periodB.endDate,
        }),
      ]);

      const result = chatAggregationService.computeComparisonFromTotals(
        {
          label: input.periodA.label,
          total: totalsA.totalIncome + totalsA.totalExpense,
          count: totalsA.count,
        },
        {
          label: input.periodB.label,
          total: totalsB.totalIncome + totalsB.totalExpense,
          count: totalsB.count,
        },
      );

      return {
        summary: result.summary,
        transactionCount: result.transactionCount,
        resolvedCategory: category?.name ?? null,
      };
    },
  });

  const getSpendingTrends = createTool({
    id: 'getSpendingTrends',
    description:
      'Returns how spending has moved over time, either overall or broken down by category, including the percentage change against the previous period.',
    inputSchema: z.object({
      period: z.enum(TREND_PERIODS).describe('Granularity of the trend points'),
      startDate: z.string().optional().describe('Start date, YYYY-MM-DD'),
      endDate: z.string().optional().describe('End date, YYYY-MM-DD'),
      categoryName: z
        .string()
        .optional()
        .describe('Restrict the trend to a single category'),
      transactionType: z.enum(['INCOME', 'EXPENSE']).optional(),
      byCategory: z
        .boolean()
        .optional()
        .describe('Set true to break the trend down per category'),
    }),
    outputSchema: z.object({
      summary: z.string(),
    }),
    execute: async (input, context) => {
      const userId = requireUserId(context);
      const category = await resolveCategory(input.categoryName);
      const categoryId = category?.id;

      const request = {
        period: input.period,
        ...(input.startDate ? { startDate: new Date(input.startDate) } : {}),
        ...(input.endDate ? { endDate: new Date(input.endDate) } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(input.transactionType
          ? { transactionType: input.transactionType }
          : {}),
      };

      if (input.byCategory) {
        const trends = await trendService.getCategorySpendingTrends(
          request,
          userId,
        );
        const lines = trends.map(
          (trend) =>
            `  ${trend.categoryName}: ${formatCurrencyPlain(trend.totalAmount)} (${chatAggregationService.formatPercentChange(trend.percentageChange)} vs previous period, trending ${trend.trend})`,
        );

        return {
          summary: lines.length
            ? `Category trends (${input.period}):\n${lines.join('\n')}`
            : 'No trend data found for that period.',
        };
      }

      const trend = await trendService.getSpendingTrends(request, userId);
      const points = trend.points.map(
        (point) =>
          `  ${point.date}: ${formatCurrencyPlain(point.amount)} (${point.count} transactions)`,
      );

      return {
        summary: [
          `Spending trend (${trend.period}${category ? `, category ${category.name}` : ''}) from ${trend.startDate} to ${trend.endDate}:`,
          ...points,
          `\nTotal: ${formatCurrencyPlain(trend.totalAmount)}`,
          `Change vs previous period: ${chatAggregationService.formatPercentChange(trend.percentageChange)} (trending ${trend.trend})`,
        ].join('\n'),
      };
    },
  });

  return {
    listCategories,
    listTransactions,
    summarizeTransactions,
    comparePeriods,
    getSpendingTrends,
  };
}
