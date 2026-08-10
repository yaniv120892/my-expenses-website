import { Transaction } from '@/shared/types/transaction';
import {
  AggregationType,
  AggregationResult,
  ComparisonPeriod,
} from '@/shared/types/chat';

class ChatAggregationService {
  /**
   * Compares two periods and returns the difference and percentage change.
   *
   * Derived figures are computed here rather than left to the model. Without
   * this, answering "how much more did I spend in February?" would mean handing
   * the assistant two totals and having it do the subtraction itself.
   */
  public computeComparison(
    periodA: ComparisonPeriod,
    periodB: ComparisonPeriod,
  ): AggregationResult {
    const figures = this.computeComparisonFigures(periodA, periodB);
    const [{ total: totalA }, { total: totalB }] = figures.periods;
    const { difference, percentChange } = figures;

    const lines = [
      `${periodA.label}: ${this.formatCurrency(totalA)} (${this.pluralize(periodA.transactions.length, 'transaction')})`,
      `${periodB.label}: ${this.formatCurrency(totalB)} (${this.pluralize(periodB.transactions.length, 'transaction')})`,
      `Difference: ${difference >= 0 ? '+' : '-'}${this.formatCurrency(Math.abs(difference))} (${periodB.label} vs ${periodA.label})`,
    ];

    const data: Record<string, number | string> = {
      [`${periodA.label} total`]: totalA,
      [`${periodB.label} total`]: totalB,
      difference,
    };

    // A percentage change against a zero baseline is undefined, not infinite.
    if (percentChange === null) {
      lines.push(
        totalB === 0
          ? 'Percentage change: not applicable (both periods are zero)'
          : `Percentage change: not applicable (${periodA.label} has no transactions to compare against)`,
      );
    } else {
      lines.push(
        `Percentage change: ${this.formatPercentChange(percentChange)}`,
      );
      data.percentChange = percentChange;
    }

    return {
      summary: lines.join('\n'),
      data,
      transactionCount:
        periodA.transactions.length + periodB.transactions.length,
    };
  }

  public aggregate(
    transactions: Transaction[],
    aggregationType: AggregationType,
  ): AggregationResult {
    switch (aggregationType) {
      case 'total':
        return this.computeTotal(transactions);
      case 'average':
        return this.computeAverage(transactions);
      case 'count':
        return this.computeCount(transactions);
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

  /**
   * The typed figures below back both the `summary` string the model reads and
   * the structured views the chat UI renders. They are one source deliberately:
   * a second implementation for the UI would eventually disagree with the
   * prose, and the user would see two different numbers for one question.
   */
  public computeTotals(transactions: Transaction[]): {
    income: number;
    expense: number;
    net: number;
  } {
    const income = this.sumByType(transactions, 'INCOME');
    const expense = this.sumByType(transactions, 'EXPENSE');

    return { income, expense, net: this.round(income - expense) };
  }

  public computeAverages(transactions: Transaction[]): {
    average: number;
    total: number;
    count: number;
  } {
    const total = this.round(
      transactions.reduce((sum, transaction) => sum + transaction.value, 0),
    );
    const count = transactions.length;
    const average = count === 0 ? 0 : this.round(total / count);

    return { average, total, count };
  }

  public computeCounts(transactions: Transaction[]): {
    total: number;
    incomeCount: number;
    expenseCount: number;
  } {
    return {
      total: transactions.length,
      incomeCount: transactions.filter((t) => t.type === 'INCOME').length,
      expenseCount: transactions.filter((t) => t.type === 'EXPENSE').length,
    };
  }

  public computeCategorySlices(
    transactions: Transaction[],
  ): { categoryName: string; amount: number; percentage: number }[] {
    const byCategory = new Map<string, number>();
    for (const transaction of transactions) {
      const name = transaction.category.name;
      byCategory.set(name, (byCategory.get(name) || 0) + transaction.value);
    }

    const sorted = [...byCategory.entries()].sort(([, a], [, b]) => b - a);
    const total = sorted.reduce((sum, [, amount]) => sum + amount, 0);

    return sorted.map(([categoryName, amount]) => ({
      categoryName,
      amount: this.round(amount),
      percentage: total === 0 ? 0 : this.round((amount / total) * 100),
    }));
  }

  public computeMonthlyPoints(
    transactions: Transaction[],
  ): { month: string; amount: number }[] {
    const byMonth = new Map<string, number>();
    for (const transaction of transactions) {
      const month = new Date(transaction.date).toISOString().slice(0, 7);
      byMonth.set(month, (byMonth.get(month) || 0) + transaction.value);
    }

    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount: this.round(amount) }));
  }

  /** Null rather than a sentinel pair when there is nothing to rank. */
  public computeExtremes(
    transactions: Transaction[],
  ): { highest: Transaction; lowest: Transaction } | null {
    if (transactions.length === 0) {
      return null;
    }

    const sorted = [...transactions].sort((a, b) => b.value - a.value);

    return { highest: sorted[0], lowest: sorted[sorted.length - 1] };
  }

  public computeComparisonFigures(
    periodA: ComparisonPeriod,
    periodB: ComparisonPeriod,
  ): {
    periods: { label: string; total: number; transactionCount: number }[];
    difference: number;
    percentChange: number | null;
  } {
    const totalA = this.sumValues(periodA.transactions);
    const totalB = this.sumValues(periodB.transactions);
    const difference = this.round(totalB - totalA);

    return {
      periods: [
        {
          label: periodA.label,
          total: totalA,
          transactionCount: periodA.transactions.length,
        },
        {
          label: periodB.label,
          total: totalB,
          transactionCount: periodB.transactions.length,
        },
      ],
      difference,
      // A percentage change against a zero baseline is undefined, not infinite.
      percentChange:
        totalA === 0 ? null : this.round((difference / totalA) * 100),
    };
  }

  private computeTotal(transactions: Transaction[]): AggregationResult {
    const { income, expense, net } = this.computeTotals(transactions);

    const lines = [
      `Total Income: ${this.formatCurrency(income)}`,
      `Total Expenses: ${this.formatCurrency(expense)}`,
      `Net: ${this.formatCurrency(net)}`,
    ];

    return {
      summary: lines.join('\n'),
      data: { income, expense, net },
      transactionCount: transactions.length,
    };
  }

  private computeAverage(transactions: Transaction[]): AggregationResult {
    if (transactions.length === 0) {
      return {
        summary: 'No transactions found to calculate an average.',
        data: { average: 0 },
        transactionCount: 0,
      };
    }

    const { average, total, count } = this.computeAverages(transactions);

    return {
      summary: `Average transaction value: ${this.formatCurrency(average)} (across ${count} transactions, total: ${this.formatCurrency(total)})`,
      data: { average, total, count },
      transactionCount: count,
    };
  }

  private computeCount(transactions: Transaction[]): AggregationResult {
    const { incomeCount, expenseCount } = this.computeCounts(transactions);

    return {
      summary: `Total transactions: ${transactions.length} (${incomeCount} income, ${expenseCount} expenses)`,
      data: { total: transactions.length, incomeCount, expenseCount },
      transactionCount: transactions.length,
    };
  }

  private computeCategoryBreakdown(
    transactions: Transaction[],
  ): AggregationResult {
    const slices = this.computeCategorySlices(transactions);
    const total = slices.reduce((sum, slice) => sum + slice.amount, 0);

    // Shares are computed here so "what percentage went to rent?" is answered
    // from a tool result rather than by dividing two numbers in the model.
    const data: Record<string, number | string> = {};
    const lines = slices.map(({ categoryName, amount, percentage }) => {
      data[categoryName] = amount;
      data[`${categoryName} %`] = percentage;
      return `  ${categoryName}: ${this.formatCurrency(amount)} (${percentage}%)`;
    });

    return {
      summary: `Spending by category:\n${lines.join('\n')}\n\nTotal: ${this.formatCurrency(total)}`,
      data,
      transactionCount: transactions.length,
    };
  }

  private computeMonthlyBreakdown(
    transactions: Transaction[],
  ): AggregationResult {
    const points = this.computeMonthlyPoints(transactions);
    const lines = points.map(
      ({ month, amount }) => `  ${month}: ${this.formatCurrency(amount)}`,
    );

    return {
      summary: `Monthly breakdown:\n${lines.join('\n')}`,
      data: Object.fromEntries(
        points.map(({ month, amount }) => [month, amount]),
      ),
      transactionCount: transactions.length,
    };
  }

  private computeMinMax(transactions: Transaction[]): AggregationResult {
    const extremes = this.computeExtremes(transactions);

    if (!extremes) {
      return {
        summary: 'No transactions found.',
        data: {},
        transactionCount: 0,
      };
    }

    const { highest, lowest } = extremes;

    return {
      summary: [
        `Highest: ${this.formatCurrency(highest.value)} — "${highest.description}" (${highest.category.name}, ${this.formatDate(highest.date)})`,
        `Lowest: ${this.formatCurrency(lowest.value)} — "${lowest.description}" (${lowest.category.name}, ${this.formatDate(lowest.date)})`,
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

  /**
   * Deliberately does not enumerate the transactions.
   *
   * The rows reach the user as a rendered table, built from the structured view
   * rather than from this string. Listing them here too would put the whole
   * table in the prompt and invite the model to retype it — which is exactly
   * how this answer used to come back, as a wall of pipe-separated text. The
   * model gets the shape of the result and lets the table speak for itself.
   */
  private formatList(transactions: Transaction[]): AggregationResult {
    if (transactions.length === 0) {
      return {
        summary: 'No transactions matched those filters.',
        data: { total: 0, totalValue: 0 },
        transactionCount: 0,
      };
    }

    const { total } = this.computeAverages(transactions);
    const dates = transactions.map((t) => this.formatDate(t.date)).sort();

    return {
      summary: [
        `${this.pluralize(transactions.length, 'transaction')} matched,`,
        `totalling ${this.formatCurrency(total)},`,
        `dated ${dates[0]} to ${dates[dates.length - 1]}.`,
        'The transactions are already shown to the user as a table —',
        'summarise them, do not list them.',
      ].join(' '),
      data: {
        total: transactions.length,
        totalValue: total,
      },
      transactionCount: transactions.length,
    };
  }

  private sumByType(
    transactions: Transaction[],
    type: 'INCOME' | 'EXPENSE',
  ): number {
    return transactions
      .filter((t) => t.type === type)
      .reduce((sum, t) => sum + t.value, 0);
  }

  private sumValues(transactions: Transaction[]): number {
    return this.round(transactions.reduce((sum, t) => sum + t.value, 0));
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

  /**
   * Public so every assistant tool renders money identically. The agent is told
   * to quote tool output verbatim, so two formats reaching it in one
   * conversation would surface as inconsistent amounts to the user.
   */
  public formatCurrency(amount: number): string {
    return `₪${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  private formatDate(date: Date): string {
    return new Date(date).toISOString().split('T')[0];
  }
}

export default new ChatAggregationService();
