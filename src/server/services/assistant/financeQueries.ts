import transactionRepository from '@/server/repositories/transactionRepository';
import categoryRepository from '@/server/repositories/categoryRepository';
import trendService from '@/server/services/trendService';
import chatAggregationService from '@/server/services/chatAggregationService';
import { CustomValidationError } from '@/server/errors/validationError';
import { formatCurrencyPlain } from '@/utils/format';
import { toUtcDayString } from '@/shared/dates';
import { collectCategorySubtree } from '@/server/utils/categoryHierarchy';
import type {
  Transaction,
  TransactionSummary,
} from '@/shared/types/transaction';
import type {
  AggregationType,
  RowAggregationType,
  TotalsAggregationType,
} from '@/shared/types/chat';
import type {
  ComparePeriodsInput,
  FoundTransactions,
  ResolvedCategory,
  SpendingTrendsInput,
  SummaryResult,
  TransactionFilterInput,
  TrendResult,
} from '@/server/services/assistant/financeQueries.types';

// Row-level aggregations (lists, breakdowns, min/max) read at most this many
// rows; when more match, the result carries an explicit partial-data note.
const MAX_TRANSACTIONS = 5000;

// What the repository receives: the category name has been resolved to its
// subtree ids, so the resolved and unresolved states cannot be confused.
type ResolvedTransactionFilters = {
  startDate?: string;
  endDate?: string;
  transactionType?: 'INCOME' | 'EXPENSE';
  searchTerm?: string;
  categoryIds?: string[];
};

type AggregationOutcome = { summary: string; transactionCount: number };

/**
 * The read-side questions both assistants answer — the in-app Mastra agent and
 * the MCP server — so a figure is computed one way whichever one asks. Every
 * method takes the user id from its caller's authenticated context, never from
 * model input.
 */
class FinanceQueryService {
  public async listCategoryNames(): Promise<string[]> {
    const categories = await categoryRepository.getAllCategories();
    return categories.map((category) => category.name);
  }

  /**
   * An unresolved or ambiguous name is a validation error the model can act
   * on by retrying with an exact name. A resolved category covers its whole
   * subtree.
   */
  public async resolveCategory(
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
        ids: collectCategorySubtree(categories, exact.id),
        name: exact.name,
      };
    }

    // Only a name-contains-query hit may resolve; a query that merely contains
    // a category name ("health care" ⊃ "Car") is suggestion material, never a
    // unique match.
    const partials = categories.filter((category) =>
      category.name.toLowerCase().includes(lowerName),
    );
    if (partials.length === 1) {
      return {
        ids: collectCategorySubtree(categories, partials[0].id),
        name: partials[0].name,
      };
    }

    const suggestions = partials.length
      ? partials
      : categories.filter((category) =>
          lowerName.includes(category.name.toLowerCase()),
        );
    const nearMatches = suggestions.map((category) => category.name);
    throw new CustomValidationError(
      nearMatches.length
        ? `Category "${categoryName}" is ambiguous. Close matches: ${nearMatches.join(', ')}. Retry with one exact name.`
        : `Unknown category "${categoryName}". Fetch the category list and retry with an exact name from it.`,
    );
  }

  public async summarize({
    userId,
    filters,
    aggregation,
  }: {
    userId: string;
    filters: TransactionFilterInput;
    aggregation: AggregationType;
  }): Promise<SummaryResult> {
    const category = await this.resolveCategory(filters.categoryName);
    const scoped = this.toResolvedFilters({ filters, category });

    const result = this.isTotalsAggregation(aggregation)
      ? chatAggregationService.aggregateFromTotals(
          await this.fetchTotals(userId, scoped),
          aggregation,
        )
      : await this.aggregateRows({ userId, filters: scoped, aggregation });

    return this.toSummaryResult(result, category);
  }

  /**
   * Reads one row past `limit`, so a caller can say the list is cut short
   * without a count query.
   */
  public async findTransactions({
    userId,
    filters,
    limit,
  }: {
    userId: string;
    filters: TransactionFilterInput;
    limit: number;
  }): Promise<FoundTransactions> {
    const category = await this.resolveCategory(filters.categoryName);
    const rows = await transactionRepository.getTransactions({
      ...this.toRepositoryFilters(
        userId,
        this.toResolvedFilters({ filters, category }),
      ),
      page: 1,
      perPage: limit + 1,
    });
    return { transactions: rows.slice(0, limit), hasMore: rows.length > limit };
  }

  public async comparePeriods({
    userId,
    input,
  }: {
    userId: string;
    input: ComparePeriodsInput;
  }): Promise<SummaryResult> {
    const category = await this.resolveCategory(input.categoryName);
    const shared: ResolvedTransactionFilters = {
      categoryIds: category?.ids,
      transactionType: input.transactionType,
    };

    const [totalsA, totalsB] = await Promise.all([
      this.fetchTotals(userId, {
        ...shared,
        startDate: input.periodA.startDate,
        endDate: input.periodA.endDate,
      }),
      this.fetchTotals(userId, {
        ...shared,
        startDate: input.periodB.startDate,
        endDate: input.periodB.endDate,
      }),
    ]);

    const result = chatAggregationService.computeComparison(
      { label: input.periodA.label, totals: totalsA },
      { label: input.periodB.label, totals: totalsB },
    );

    return this.toSummaryResult(result, category);
  }

  public async describeSpendingTrends({
    userId,
    input,
  }: {
    userId: string;
    input: SpendingTrendsInput;
  }): Promise<TrendResult> {
    const category = await this.resolveCategory(input.categoryName);
    const resolvedCategory = category?.name ?? null;

    const request = {
      period: input.period,
      ...(input.startDate ? { startDate: new Date(input.startDate) } : {}),
      ...(input.endDate ? { endDate: new Date(input.endDate) } : {}),
      ...(category ? { categoryIds: category.ids } : {}),
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
        resolvedCategory,
      };
    }

    const trend = await trendService.getSpendingTrends(request, userId);
    const firstDay = toUtcDayString(new Date(trend.startDate));
    const lastDay = toUtcDayString(new Date(trend.endDate));
    const points = trend.points.map(
      (point) =>
        `  ${point.date}: ${formatCurrencyPlain(point.amount)} (${point.count} transactions)`,
    );

    return {
      summary: [
        `Spending trend (${trend.period}) from ${firstDay} to ${lastDay}:`,
        ...points,
        `\nTotal: ${formatCurrencyPlain(trend.totalAmount)}`,
        `Change vs previous period: ${chatAggregationService.formatPercentChange(trend.percentageChange)} (trending ${trend.trend})`,
      ].join('\n'),
      resolvedCategory,
    };
  }

  private isTotalsAggregation(
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

  private toSummaryResult(
    result: AggregationOutcome,
    category?: ResolvedCategory,
  ): SummaryResult {
    return {
      summary: result.summary,
      transactionCount: result.transactionCount,
      resolvedCategory: category?.name ?? null,
    };
  }

  private async aggregateRows({
    userId,
    filters,
    aggregation,
  }: {
    userId: string;
    filters: ResolvedTransactionFilters;
    aggregation: RowAggregationType;
  }): Promise<AggregationOutcome> {
    const transactions = await this.fetchTransactions(userId, filters);
    const result = chatAggregationService.aggregate(transactions, aggregation);
    // A short page proves every matching row was read; only a full page needs
    // the count query to say how much is missing.
    if (transactions.length < MAX_TRANSACTIONS) {
      return result;
    }
    const { count } = await this.fetchTotals(userId, filters);
    if (count <= transactions.length) {
      return result;
    }
    return {
      ...result,
      summary: `${result.summary}\n\nNote: computed from the newest ${transactions.length} of ${count} matching transactions — report these figures as partial.`,
    };
  }

  // Field-by-field rather than a spread, so the unresolved categoryName can
  // never ride along into the resolved shape.
  private toResolvedFilters({
    filters,
    category,
  }: {
    filters: TransactionFilterInput;
    category: ResolvedCategory | undefined;
  }): ResolvedTransactionFilters {
    return {
      startDate: filters.startDate,
      endDate: filters.endDate,
      transactionType: filters.transactionType,
      searchTerm: filters.searchTerm,
      categoryIds: category?.ids,
    };
  }

  private toRepositoryFilters(
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

  private async fetchTotals(
    userId: string,
    filters: ResolvedTransactionFilters,
  ): Promise<TransactionSummary> {
    return transactionRepository.getTransactionsSummary(
      this.toRepositoryFilters(userId, filters),
    );
  }

  private async fetchTransactions(
    userId: string,
    filters: ResolvedTransactionFilters,
  ): Promise<Transaction[]> {
    return transactionRepository.getTransactions({
      ...this.toRepositoryFilters(userId, filters),
      page: 1,
      perPage: MAX_TRANSACTIONS,
    });
  }
}

const financeQueryService = new FinanceQueryService();
export default financeQueryService;
