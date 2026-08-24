import { Transaction, TransactionSummary } from '@/shared/types/transaction';
import {
  AggregationResult,
  RowAggregationType,
  TotalsAggregationType,
} from '@/shared/types/chat';
import { formatCurrencyPlain } from '@/utils/format';

export interface ComparisonPeriodTotals {
  label: string;
  totals: TransactionSummary;
}

class ChatAggregationService {
  /**
   * Compares two periods from their SQL summaries and returns the difference
   * and percentage change. Derived figures are computed here rather than left
   * to the model: answering "how much more did I spend in February?" must not
   * mean handing the assistant two totals and having it subtract.
   */
  public computeComparison(
    periodA: ComparisonPeriodTotals,
    periodB: ComparisonPeriodTotals,
  ): AggregationResult {
    const totalA = this.round(this.combinedTotal(periodA.totals));
    const totalB = this.round(this.combinedTotal(periodB.totals));
    const difference = this.round(totalB - totalA);

    const lines = [
      `${periodA.label}: ${formatCurrencyPlain(totalA)} (${this.pluralize(periodA.totals.count, 'transaction')})`,
      `${periodB.label}: ${formatCurrencyPlain(totalB)} (${this.pluralize(periodB.totals.count, 'transaction')})`,
      `Difference: ${difference >= 0 ? '+' : '-'}${formatCurrencyPlain(Math.abs(difference))} (${periodB.label} vs ${periodA.label})`,
    ];

    const data: Record<string, number | string> = {
      [`${periodA.label} total`]: totalA,
      [`${periodB.label} total`]: totalB,
      difference,
    };

    // A percentage change against a zero baseline is undefined, not infinite.
    if (totalA === 0) {
      lines.push(
        totalB === 0
          ? 'Percentage change: not applicable (both periods are zero)'
          : `Percentage change: not applicable (${periodA.label} has no transactions to compare against)`,
      );
    } else {
      const percentChange = this.round((difference / totalA) * 100);
      lines.push(
        `Percentage change: ${this.formatPercentChange(percentChange)}`,
      );
      data.percentChange = percentChange;
    }

    return {
      summary: lines.join('\n'),
      data,
      transactionCount: periodA.totals.count + periodB.totals.count,
    };
  }

  /**
   * Totals, counts and averages come from a SQL summary instead of loaded
   * rows, so they are exact however many rows match.
   */
  public aggregateFromTotals(
    totals: TransactionSummary,
    aggregationType: TotalsAggregationType,
  ): AggregationResult {
    switch (aggregationType) {
      case 'total': {
        const net = totals.totalIncome - totals.totalExpense;
        return {
          summary: [
            `Total Income: ${formatCurrencyPlain(totals.totalIncome)}`,
            `Total Expenses: ${formatCurrencyPlain(totals.totalExpense)}`,
            `Net: ${formatCurrencyPlain(net)}`,
          ].join('\n'),
          data: {
            income: totals.totalIncome,
            expense: totals.totalExpense,
            net,
          },
          transactionCount: totals.count,
        };
      }
      case 'average': {
        if (totals.count === 0) {
          return {
            summary: 'No transactions found to calculate an average.',
            data: { average: 0 },
            transactionCount: 0,
          };
        }
        const total = this.combinedTotal(totals);
        const average = this.round(total / totals.count);
        return {
          summary: `Average transaction value: ${formatCurrencyPlain(average)} (across ${totals.count} transactions, total: ${formatCurrencyPlain(total)})`,
          data: { average, total, count: totals.count },
          transactionCount: totals.count,
        };
      }
      case 'count':
        return {
          summary: `Total transactions: ${totals.count} (${totals.incomeCount} income, ${totals.expenseCount} expenses)`,
          data: {
            total: totals.count,
            incomeCount: totals.incomeCount,
            expenseCount: totals.expenseCount,
          },
          transactionCount: totals.count,
        };
    }
  }

  public aggregate(
    transactions: Transaction[],
    aggregationType: RowAggregationType,
  ): AggregationResult {
    switch (aggregationType) {
      case 'breakdown_by_category':
        return this.computeCategoryBreakdown(transactions);
      case 'breakdown_by_month':
        return this.computeMonthlyBreakdown(transactions);
      case 'min_max':
        return this.computeMinMax(transactions);
      case 'list':
        return this.formatList(transactions);
    }
  }

  private computeCategoryBreakdown(
    transactions: Transaction[],
  ): AggregationResult {
    const byCategory = new Map<string, number>();
    for (const t of transactions) {
      const name = t.category.name;
      byCategory.set(name, (byCategory.get(name) || 0) + t.value);
    }

    const sorted = [...byCategory.entries()].sort(([, a], [, b]) => b - a);
    const total = sorted.reduce((sum, [, amount]) => sum + amount, 0);

    // Shares are computed here so "what percentage went to rent?" is answered
    // from a tool result rather than by dividing two numbers in the model.
    const data: Record<string, number | string> = {};
    const lines = sorted.map(([name, amount]) => {
      const share = total === 0 ? 0 : this.round((amount / total) * 100);
      data[name] = amount;
      data[`${name} %`] = share;
      return `  ${name}: ${formatCurrencyPlain(amount)} (${share}%)`;
    });

    return {
      summary: `Spending by category:\n${lines.join('\n')}\n\nTotal: ${formatCurrencyPlain(total)}`,
      data,
      transactionCount: transactions.length,
    };
  }

  private computeMonthlyBreakdown(
    transactions: Transaction[],
  ): AggregationResult {
    const byMonth = new Map<string, number>();
    for (const t of transactions) {
      const month = new Date(t.date).toISOString().slice(0, 7);
      byMonth.set(month, (byMonth.get(month) || 0) + t.value);
    }

    const sorted = [...byMonth.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const lines = sorted.map(
      ([month, amount]) => `  ${month}: ${formatCurrencyPlain(amount)}`,
    );

    return {
      summary: `Monthly breakdown:\n${lines.join('\n')}`,
      data: Object.fromEntries(sorted),
      transactionCount: transactions.length,
    };
  }

  private computeMinMax(transactions: Transaction[]): AggregationResult {
    if (transactions.length === 0) {
      return {
        summary: 'No transactions found.',
        data: {},
        transactionCount: 0,
      };
    }

    const sorted = [...transactions].sort((a, b) => b.value - a.value);
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];

    return {
      summary: [
        `Highest: ${formatCurrencyPlain(highest.value)} — "${highest.description}" (${highest.category.name}, ${this.formatDate(highest.date)})`,
        `Lowest: ${formatCurrencyPlain(lowest.value)} — "${lowest.description}" (${lowest.category.name}, ${this.formatDate(lowest.date)})`,
      ].join('\n'),
      data: {
        highestValue: highest.value,
        highestDescription: highest.description,
        lowestValue: lowest.value,
        lowestDescription: lowest.description,
      },
      transactionCount: transactions.length,
    };
  }

  private formatList(transactions: Transaction[]): AggregationResult {
    const top = transactions.slice(0, 10);
    const total = transactions.reduce((sum, t) => sum + t.value, 0);

    const lines = top.map(
      (t) =>
        `  - ${this.formatDate(t.date)} | ${t.description} | ${formatCurrencyPlain(t.value)} | ${t.category.name} (${t.type})`,
    );

    const summaryParts = [
      `Showing ${top.length} of ${transactions.length} transactions:`,
      ...lines,
    ];
    if (transactions.length > 10) {
      summaryParts.push(`  ... and ${transactions.length - 10} more`);
    }
    summaryParts.push(`\nTotal value: ${formatCurrencyPlain(total)}`);

    return {
      summary: summaryParts.join('\n'),
      data: {
        shown: top.length,
        total: transactions.length,
        totalValue: total,
      },
      transactionCount: transactions.length,
    };
  }

  private combinedTotal(totals: TransactionSummary): number {
    return totals.totalIncome + totals.totalExpense;
  }

  /** Formats a signed percentage the way computeComparison reports one. */
  public formatPercentChange(value: number): string {
    return `${value >= 0 ? '+' : ''}${value}%`;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private pluralize(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? '' : 's'}`;
  }

  private formatDate(date: Date): string {
    return new Date(date).toISOString().split('T')[0];
  }
}

export default new ChatAggregationService();
