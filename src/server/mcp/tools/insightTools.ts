import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import financeQueryService from '@/server/services/assistant/financeQueries';
import {
  comparePeriodsShape,
  spendingTrendsShape,
  summaryAggregationSchema,
  transactionFilterShape,
} from '@/server/services/assistant/financeQuerySchemas';
import type {
  ComparePeriodsInput,
  SpendingTrendsInput,
  SummaryResult,
  TransactionFilterInput,
} from '@/server/services/assistant/financeQueries.types';
import type { AggregationType } from '@/shared/types/chat';
import { toolSuccess, withToolErrorHandling } from '@/server/mcp/toolResult';
import type { McpActor } from '@/server/mcp/toolSchemas.types';

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

type SummarizeInput = TransactionFilterInput & {
  aggregation: AggregationType;
};

export function registerInsightTools(
  server: McpServer,
  { userId }: McpActor,
): void {
  server.registerTool(
    'list_categories',
    {
      title: 'List categories',
      description:
        'Lists every category name. Call it before passing categoryName to any other tool; category names are in English, so map what the user said onto one of these.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    withToolErrorHandling({
      toolName: 'list_categories',
      userId,
      handler: async () => {
        const names = await financeQueryService.listCategoryNames();
        return toolSuccess(names.join('\n'));
      },
    }),
  );

  server.registerTool(
    'summarize_transactions',
    {
      title: 'Summarize transactions',
      description:
        'Computes a figure over the transactions matching the filters: total, average, count, breakdown by category, breakdown by month, or highest/lowest. All arithmetic is done server-side and every figure is in ILS; report the numbers exactly as returned and never add amounts yourself.',
      inputSchema: {
        ...transactionFilterShape,
        aggregation: summaryAggregationSchema,
      },
      annotations: READ_ONLY,
    },
    withToolErrorHandling({
      toolName: 'summarize_transactions',
      userId,
      handler: async (input: SummarizeInput) =>
        toolSuccess(
          describeSummary(
            await financeQueryService.summarize({
              userId,
              filters: input,
              aggregation: input.aggregation,
            }),
          ),
        ),
    }),
  );

  server.registerTool(
    'compare_periods',
    {
      title: 'Compare two periods',
      description:
        'Compares the totals of two date ranges and returns the difference and percentage change, computed server-side. Use it for every "this month vs last month" question instead of subtracting two summaries yourself.',
      inputSchema: comparePeriodsShape,
      annotations: READ_ONLY,
    },
    withToolErrorHandling({
      toolName: 'compare_periods',
      userId,
      handler: async (input: ComparePeriodsInput) =>
        toolSuccess(
          describeSummary(
            await financeQueryService.comparePeriods({ userId, input }),
          ),
        ),
    }),
  );

  server.registerTool(
    'get_spending_trends',
    {
      title: 'Get spending trends',
      description:
        'Shows how spending moved over time (daily, weekly, monthly or yearly points), overall or per category, with the change against the previous period.',
      inputSchema: spendingTrendsShape,
      annotations: READ_ONLY,
    },
    withToolErrorHandling({
      toolName: 'get_spending_trends',
      userId,
      handler: async (input: SpendingTrendsInput) => {
        const trend = await financeQueryService.describeSpendingTrends({
          userId,
          input,
        });
        return toolSuccess(
          withCategoryNote({
            summary: trend.summary,
            resolvedCategory: trend.resolvedCategory,
            coversSubcategories: false,
          }),
        );
      },
    }),
  );
}

function describeSummary(result: SummaryResult): string {
  return withCategoryNote({
    summary: result.summary,
    resolvedCategory: result.resolvedCategory,
    coversSubcategories: true,
  });
}

// Says which category a partial name resolved to, so the agent reports the
// figure under the name it actually covers.
function withCategoryNote({
  summary,
  resolvedCategory,
  coversSubcategories,
}: {
  summary: string;
  resolvedCategory: string | null;
  coversSubcategories: boolean;
}): string {
  if (!resolvedCategory) {
    return summary;
  }
  const scope = coversSubcategories ? ' (including its subcategories)' : '';
  return `${summary}\n\nCategory: ${resolvedCategory}${scope}`;
}
