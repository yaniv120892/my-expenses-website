import { z } from 'zod';
import type { HouseholdId } from '@/server/auth/householdActor.types';
import { isHouseholdId } from '@/server/auth/householdId';
import { createTool } from '@mastra/core/tools';
import financeQueryService from '@/server/services/assistant/financeQueries';
import {
  comparePeriodsSchema,
  spendingTrendsSchema,
  summaryAggregationSchema,
  summaryOutputSchema,
  transactionFilterSchema,
  trendOutputSchema,
} from '@/server/services/assistant/financeQuerySchemas';

export const HOUSEHOLD_ID_CONTEXT_KEY = 'householdId';

/**
 * The household comes from the server-side request context, never the
 * inputSchema, so a prompt-injected message cannot read another household's data.
 */
function requireHouseholdId(context: {
  requestContext?: { get: (key: string) => unknown };
}): HouseholdId {
  const householdId = context.requestContext?.get(HOUSEHOLD_ID_CONTEXT_KEY);

  if (!isHouseholdId(householdId)) {
    throw new Error('Assistant tool called without an authenticated household');
  }

  return householdId;
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
      requireHouseholdId(context);
      return { categories: await financeQueryService.listCategoryNames() };
    },
  });

  const listTransactions = createTool({
    id: 'listTransactions',
    description:
      'Lists individual transactions matching the given filters. Use this when the user wants to see specific transactions rather than a total. Amounts are in ILS; a charge made in another currency shows its original amount first, e.g. "$25.00 · 92.35 ₪".',
    inputSchema: transactionFilterSchema,
    outputSchema: summaryOutputSchema,
    execute: async (input, context) =>
      financeQueryService.summarize({
        householdId: requireHouseholdId(context),
        filters: input,
        aggregation: 'list',
      }),
  });

  const summarizeTransactions = createTool({
    id: 'summarizeTransactions',
    description:
      'Computes a figure over the transactions matching the filters — a total, average, count, category breakdown, monthly breakdown, or highest/lowest. All arithmetic is done server-side; use the returned numbers exactly as given. Every figure is in ILS: a charge made in another currency counts at the ILS amount it was converted to, so never add original foreign amounts yourself.',
    inputSchema: transactionFilterSchema.extend({
      aggregation: summaryAggregationSchema,
    }),
    outputSchema: summaryOutputSchema,
    execute: async (input, context) =>
      financeQueryService.summarize({
        householdId: requireHouseholdId(context),
        filters: input,
        aggregation: input.aggregation,
      }),
  });

  const comparePeriods = createTool({
    id: 'comparePeriods',
    description:
      'Compares two date ranges and returns both totals along with the difference and percentage change, all computed server-side. Always use this for comparisons instead of calling summarizeTransactions twice and subtracting the results yourself.',
    inputSchema: comparePeriodsSchema,
    outputSchema: summaryOutputSchema,
    execute: async (input, context) =>
      financeQueryService.comparePeriods({
        householdId: requireHouseholdId(context),
        input,
      }),
  });

  const getSpendingTrends = createTool({
    id: 'getSpendingTrends',
    description:
      'Returns how spending has moved over time, either overall or broken down by category, including the percentage change against the previous period.',
    inputSchema: spendingTrendsSchema,
    outputSchema: trendOutputSchema,
    execute: async (input, context) =>
      financeQueryService.describeSpendingTrends({
        householdId: requireHouseholdId(context),
        input,
      }),
  });

  return {
    listCategories,
    listTransactions,
    summarizeTransactions,
    comparePeriods,
    getSpendingTrends,
  };
}
