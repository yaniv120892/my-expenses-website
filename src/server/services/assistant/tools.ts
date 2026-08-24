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
import { expandCategoryToSubtree } from '@/server/utils/categoryHierarchy';
import { Transaction, TransactionSummary } from '@/shared/types/transaction';
import {
  AggregationType,
  RowAggregationType,
  TotalsAggregationType,
} from '@/shared/types/chat';
import { TREND_PERIODS } from '@/shared/types/trends';

export const USER_ID_CONTEXT_KEY = 'userId';

// Row-level aggregations (lists, breakdowns, min/max) read at most this many
// rows; when more match, the result carries an explicit partial-data note.
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

type DateFilterInput = z.infer<typeof dateFilterSchema>;

// What the repository receives: the category name has been resolved to its
// subtree ids, so the resolved and unresolved states cannot be confused.
type ResolvedTransactionFilters = {
  startDate?: string;
  endDate?: string;
  transactionType?: 'INCOME' | 'EXPENSE';
  searchTerm?: string;
  categoryIds?: string[];
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

type ResolvedCategory = { ids: string[]; name: string };

/**
 * A name that resolves to nothing or to several categories is a tool error
 * rather than a silently dropped or arbitrarily chosen filter; the error text
 * is model-facing so the model can retry with an exact name. A resolved
 * category covers its whole subtree, matching how the transactions list
 * filters.
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
    return {
      ids: await expandCategoryToSubtree(exact.id),
      name: exact.name,
    };
  }

  const partials = categories.filter(
    (category) =>
      category.name.toLowerCase().includes(lowerName) ||
      lowerName.includes(category.name.toLowerCase()),
  );
  if (partials.length === 1) {
    return {
      ids: await expandCategoryToSubtree(partials[0].id),
      name: partials[0].name,
    };
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

export type SummaryToolResult = z.infer<typeof summaryOutputSchema>;

function toToolResult(
  result: { summary: string; transactionCount: number },
  category?: ResolvedCategory,
): SummaryToolResult {
  return {
    summary: result.summary,
    transactionCount: result.transactionCount,
    resolvedCategory: category?.name ?? null,
  };
}

async function summarize(
  userId: string,
  filters: DateFilterInput,
  aggregation: AggregationType,
): Promise<SummaryToolResult> {
  const category = await resolveCategory(filters.categoryName);
  const scoped: ResolvedTransactionFilters = {
    ...filters,
    categoryIds: category?.ids,
  };

  const result = isTotalsAggregation(aggregation)
    ? chatAggregationService.aggregateFromTotals(
        await fetchTotals(userId, scoped),
        aggregation,
      )
    : await aggregateRows(userId, scoped, aggregation);

  return toToolResult(result, category);
}

async function aggregateRows(
  userId: string,
  filters: ResolvedTransactionFilters,
  aggregation: RowAggregationType,
): Promise<{ summary: string; transactionCount: number }> {
  const transactions = await fetchTransactions(userId, filters);
  const result = chatAggregationService.aggregate(transactions, aggregation);
  // A short page proves every matching row was read; only a full page needs
  // the count query to say how much is missing.
  if (transactions.length < MAX_TRANSACTIONS) {
    return result;
  }
  const { count } = await fetchTotals(userId, filters);
  if (count <= transactions.length) {
    return result;
  }
  return {
    ...result,
    summary: `${result.summary}\n\nNote: computed from the newest ${transactions.length} of ${count} matching transactions — report these figures as partial.`,
  };
}

function toRepositoryFilters(
  userId: string,
  filters: ResolvedTransactionFilters,
) {
  return {
    userId,
    ...(filters.startDate ? { startDate: new Date(filters.startDate) } : {}),
    ...(filters.endDate ? { endDate: new Date(filters.endDate) } : {}),
    ...(filters.transactionType
      ? { transactionType: filters.transactionType }
      : {}),
    ...(filters.searchTerm ? { searchTerm: filters.searchTerm } : {}),
    ...(filters.categoryIds ? { categoryIds: filters.categoryIds } : {}),
  };
}

async function fetchTotals(
  userId: string,
  filters: ResolvedTransactionFilters,
): Promise<TransactionSummary> {
  return transactionRepository.getTransactionsSummary(
    toRepositoryFilters(userId, filters),
  );
}

async function fetchTransactions(
  userId: string,
  filters: ResolvedTransactionFilters,
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

      const category = await resolveCategory(input.categoryName);
      const shared: ResolvedTransactionFilters = {
        categoryIds: category?.ids,
        transactionType: input.transactionType,
      };

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

      const result = chatAggregationService.computeComparison(
        { label: input.periodA.label, totals: totalsA },
        { label: input.periodB.label, totals: totalsB },
      );

      return toToolResult(result, category);
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
      resolvedCategory: z.string().nullable(),
    }),
    execute: async (input, context) => {
      const userId = requireUserId(context);
      const category = await resolveCategory(input.categoryName);
      // The subtree's root id: trendService takes one categoryId and filters
      // it exact-match today — expanding trends to the subtree is a separate
      // fix, tracked with trendService's own exact-match filter.
      const categoryId = category?.ids[0];

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
          resolvedCategory: category?.name ?? null,
        };
      }

      const trend = await trendService.getSpendingTrends(request, userId);
      const points = trend.points.map(
        (point) =>
          `  ${point.date}: ${formatCurrencyPlain(point.amount)} (${point.count} transactions)`,
      );

      return {
        summary: [
          `Spending trend (${trend.period}) from ${trend.startDate} to ${trend.endDate}:`,
          ...points,
          `\nTotal: ${formatCurrencyPlain(trend.totalAmount)}`,
          `Change vs previous period: ${chatAggregationService.formatPercentChange(trend.percentageChange)} (trending ${trend.trend})`,
        ].join('\n'),
        resolvedCategory: category?.name ?? null,
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
