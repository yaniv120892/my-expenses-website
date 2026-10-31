import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import financeQueryService from '@/server/services/assistant/financeQueries';
import { summaryAggregationSchema } from '@/server/services/assistant/financeQuerySchemas';
import { READ_ONLY, registerSafeTool } from '@/server/mcp/safeTool';
import {
  comparePeriodsToolShape,
  spendingTrendsToolShape,
  transactionFilterToolShape,
} from '@/server/mcp/toolSchemas';
import type { McpActor } from '@/server/mcp/createMcpServer.types';

export function registerInsightTools({
  server,
  actor,
}: {
  server: McpServer;
  actor: McpActor;
}): void {
  const { householdId } = actor;

  registerSafeTool({
    server,
    actor,
    name: 'list_categories',
    config: {
      title: 'List categories',
      description:
        'Lists every category name. Call it before passing categoryName to any other tool; category names are in English, so map what the user said onto one of these.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    handler: async () => {
      const names = await financeQueryService.listCategoryNames();
      return names.join('\n');
    },
  });

  registerSafeTool({
    server,
    actor,
    name: 'summarize_transactions',
    config: {
      title: 'Summarize transactions',
      description:
        'Computes a figure over the transactions matching the filters: total, average, count, breakdown by category, breakdown by month, or highest/lowest. All arithmetic is done server-side and every figure is in ILS; report the numbers exactly as returned and never add amounts yourself.',
      inputSchema: {
        ...transactionFilterToolShape,
        aggregation: summaryAggregationSchema,
      },
      annotations: READ_ONLY,
    },
    handler: async (input) =>
      withCategoryNote(
        await financeQueryService.summarize({
          householdId,
          filters: input,
          aggregation: input.aggregation,
        }),
      ),
  });

  registerSafeTool({
    server,
    actor,
    name: 'compare_periods',
    config: {
      title: 'Compare two periods',
      description:
        'Compares the totals of two date ranges and returns the difference and percentage change, computed server-side. Use it for every "this month vs last month" question instead of subtracting two summaries yourself.',
      inputSchema: comparePeriodsToolShape,
      annotations: READ_ONLY,
    },
    handler: async (input) =>
      withCategoryNote(await financeQueryService.comparePeriods({ householdId, input })),
  });

  registerSafeTool({
    server,
    actor,
    name: 'get_spending_trends',
    config: {
      title: 'Get spending trends',
      description:
        'Shows how spending moved over time (daily, weekly, monthly or yearly points), overall or per category, with the change against the previous period.',
      inputSchema: spendingTrendsToolShape,
      annotations: READ_ONLY,
    },
    handler: async (input) =>
      withCategoryNote(await financeQueryService.describeSpendingTrends({ householdId, input })),
  });
}

// Says which category a partial name resolved to, so the agent reports the
// figure under the name it actually covers.
function withCategoryNote({
  summary,
  resolvedCategory,
}: {
  summary: string;
  resolvedCategory: string | null;
}): string {
  if (!resolvedCategory) {
    return summary;
  }
  return `${summary}\n\nCategory: ${resolvedCategory} (including its subcategories)`;
}
