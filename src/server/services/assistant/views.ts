import { Transaction } from '@/shared/types/transaction';
import {
  AggregationType,
  AssistantView,
  ComparisonPeriod,
  TransactionListView,
  ViewTransactionRow,
} from '@/shared/types/chat';
import {
  CategorySpendingTrend,
  SpendingTrend,
  TrendPeriod,
} from '@/shared/types/trends';
import chatAggregationService from '@/server/services/chatAggregationService';

/**
 * How many rows a transaction list view carries.
 *
 * Higher than the ten the `summary` string shows, because the UI renders a
 * scrollable list rather than lines of prose, but still bounded — the filters
 * can match thousands, and every row crosses the SSE connection.
 */
const MAX_VIEW_ROWS = 25;

export function buildTransactionListView(
  transactions: Transaction[],
  title?: string,
): TransactionListView {
  const { total } = chatAggregationService.computeAverages(transactions);

  return {
    kind: 'transactionList',
    ...(title ? { title } : {}),
    items: transactions.slice(0, MAX_VIEW_ROWS).map(toViewRow),
    totalCount: transactions.length,
    totalValue: total,
  };
}

/**
 * Picks the view that matches what the user actually asked for. Returns null
 * when there is nothing worth drawing — an empty result set reads better as the
 * assistant's sentence than as an empty card.
 */
export function buildAggregationView(
  transactions: Transaction[],
  aggregation: AggregationType,
): AssistantView | null {
  if (transactions.length === 0) {
    return null;
  }

  switch (aggregation) {
    case 'list':
      return buildTransactionListView(transactions);

    case 'total': {
      const { income, expense, net } =
        chatAggregationService.computeTotals(transactions);

      return {
        kind: 'stats',
        stats: [
          {
            label: 'Income',
            value: income,
            format: 'currency',
            tone: 'income',
          },
          {
            label: 'Expenses',
            value: expense,
            format: 'currency',
            tone: 'expense',
          },
          {
            label: 'Net',
            value: net,
            format: 'currency',
            tone: net >= 0 ? 'income' : 'expense',
          },
        ],
      };
    }

    case 'average': {
      const { average, total, count } =
        chatAggregationService.computeAverages(transactions);

      return {
        kind: 'stats',
        stats: [
          { label: 'Average', value: average, format: 'currency' },
          { label: 'Total', value: total, format: 'currency' },
          { label: 'Transactions', value: count, format: 'number' },
        ],
      };
    }

    case 'count': {
      const { total, incomeCount, expenseCount } =
        chatAggregationService.computeCounts(transactions);

      return {
        kind: 'stats',
        stats: [
          { label: 'Transactions', value: total, format: 'number' },
          {
            label: 'Income',
            value: incomeCount,
            format: 'number',
            tone: 'income',
          },
          {
            label: 'Expenses',
            value: expenseCount,
            format: 'number',
            tone: 'expense',
          },
        ],
      };
    }

    case 'breakdown_by_category': {
      const slices = chatAggregationService.computeCategorySlices(transactions);

      return {
        kind: 'categoryBreakdown',
        slices,
        total: slices.reduce((sum, slice) => sum + slice.amount, 0),
      };
    }

    case 'breakdown_by_month': {
      const points = chatAggregationService.computeMonthlyPoints(transactions);

      return {
        kind: 'trend',
        period: 'monthly',
        points: points.map(({ month, amount }) => ({ date: month, amount })),
        totalAmount: points.reduce((sum, point) => sum + point.amount, 0),
        percentageChange: null,
      };
    }

    case 'min_max': {
      const extremes = chatAggregationService.computeExtremes(transactions);

      if (!extremes) {
        return null;
      }

      // The same row component as any other list, so the biggest and smallest
      // expense read identically to the rest of the app.
      return {
        kind: 'transactionList',
        title: 'Highest and lowest',
        items: [toViewRow(extremes.highest), toViewRow(extremes.lowest)],
        totalCount: transactions.length,
        totalValue: extremes.highest.value + extremes.lowest.value,
      };
    }

    default:
      return null;
  }
}

export function buildComparisonView(
  periodA: ComparisonPeriod,
  periodB: ComparisonPeriod,
): AssistantView {
  const { periods, difference, percentChange } =
    chatAggregationService.computeComparisonFigures(periodA, periodB);

  return { kind: 'comparison', periods, difference, percentChange };
}

export function buildTrendView(trend: SpendingTrend): AssistantView | null {
  if (trend.points.length === 0) {
    return null;
  }

  return {
    kind: 'trend',
    period: trend.period,
    points: trend.points.map((point) => ({
      date: point.date,
      amount: point.amount,
      count: point.count,
    })),
    totalAmount: trend.totalAmount,
    percentageChange: trend.percentageChange,
  };
}

/**
 * Per-category trends collapse to a breakdown rather than a multi-series chart:
 * one bar per category answers "where is the money going" without needing a
 * legend of a dozen lines in a chat bubble.
 */
export function buildCategoryTrendView(
  trends: CategorySpendingTrend[],
  period: TrendPeriod,
): AssistantView | null {
  if (trends.length === 0) {
    return null;
  }

  const total = trends.reduce((sum, trend) => sum + trend.totalAmount, 0);

  return {
    kind: 'categoryBreakdown',
    title: `Category trends (${period})`,
    slices: trends.map((trend) => ({
      categoryName: trend.categoryName,
      amount: trend.totalAmount,
      percentage:
        total === 0 ? 0 : Math.round((trend.totalAmount / total) * 10000) / 100,
    })),
    total,
  };
}

function toViewRow(transaction: Transaction): ViewTransactionRow {
  return {
    id: transaction.id,
    description: transaction.description,
    value: transaction.value,
    date: new Date(transaction.date).toISOString(),
    type: transaction.type,
    categoryName: transaction.category.name,
  };
}
