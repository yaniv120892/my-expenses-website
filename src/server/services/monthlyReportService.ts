import { endOfMonth, format, startOfMonth, subMonths } from 'date-fns';
import { parse } from 'json2csv';
import transactionService from '@/server/services/transactionService';
import userSettingsService from '@/server/services/userSettingsService';
import emailService from '@/server/services/emailService';
import { classifyTrend, TrendDirection } from '@/server/utils/trendMath';
import { Transaction } from '@/shared/types/transaction';
import logger from '@/server/logging/logger';

interface CategoryTotal {
  categoryName: string;
  income: number;
  expense: number;
  count: number;
}

interface MonthlyReport {
  monthLabel: string;
  totalIncome: number;
  totalExpense: number;
  net: number;
  transactionCount: number;
  expenseChangePercentage: number;
  expenseTrend: TrendDirection;
  categories: CategoryTotal[];
}

// Module-level so a formatter is not constructed per row.
const ilsFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
});

class MonthlyReportService {
  public async sendMonthlyReportToAllUsers(
    referenceDate: Date = new Date(),
  ): Promise<void> {
    const userIds = await userSettingsService.getUsersRequiredMonthlyReport();
    const reportMonth = subMonths(referenceDate, 1);

    for (const userId of userIds) {
      // Guarded per user so one failure cannot abort the run for the rest.
      try {
        await this.sendMonthlyReport(userId, reportMonth);
      } catch (err) {
        logger.error({ err, userId }, 'Failed to send monthly report');
      }
    }
  }

  private async sendMonthlyReport(
    userId: string,
    reportMonth: Date,
  ): Promise<void> {
    const userSettings = await userSettingsService.getUserSettings(userId);
    if (!userSettings) {
      logger.warn({ userId }, 'Skipping monthly report, user settings missing');
      return;
    }

    const [transactions, previousTransactions] = await Promise.all([
      this.getMonthTransactions(userId, reportMonth),
      this.getMonthTransactions(userId, subMonths(reportMonth, 1)),
    ]);

    if (transactions.length === 0) {
      logger.info({ userId }, 'Skipping monthly report, no transactions');
      return;
    }

    const report = this.buildReport(
      transactions,
      previousTransactions,
      reportMonth,
    );
    const csv = this.buildCsv(transactions);

    await emailService.send({
      to: userSettings.info.email,
      subject: `Your ${report.monthLabel} expense report`,
      text: this.buildReportText(report),
      html: this.buildReportHtml(report),
      attachments: [
        {
          filename: `transactions_${format(reportMonth, 'yyyy-MM')}.csv`,
          // Excel only detects UTF-8 from a BOM, and category names are Hebrew.
          content: Buffer.from(`﻿${csv}`, 'utf8'),
          contentType: 'text/csv; charset=utf-8',
        },
      ],
    });
  }

  private getMonthTransactions(
    userId: string,
    month: Date,
  ): Promise<Transaction[]> {
    return transactionService.getAllTransactions({
      userId,
      status: 'APPROVED',
      startDate: startOfMonth(month),
      endDate: endOfMonth(month),
    });
  }

  private buildReport(
    transactions: Transaction[],
    previousTransactions: Transaction[],
    reportMonth: Date,
  ): MonthlyReport {
    const totalIncome = this.sumByType(transactions, 'INCOME');
    const totalExpense = this.sumByType(transactions, 'EXPENSE');
    const previousExpense = this.sumByType(previousTransactions, 'EXPENSE');
    const { percentage, trend } = classifyTrend(totalExpense, previousExpense);

    return {
      monthLabel: format(reportMonth, 'MMMM yyyy'),
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
      transactionCount: transactions.length,
      expenseChangePercentage: percentage,
      expenseTrend: trend,
      categories: this.groupByCategory(transactions),
    };
  }

  private sumByType(transactions: Transaction[], type: string): number {
    return transactions
      .filter((transaction) => transaction.type === type)
      .reduce((sum, transaction) => sum + transaction.value, 0);
  }

  // Grouped by the transaction's own category rather than its top-level
  // ancestor, so sibling categories stay distinguishable in the report.
  private groupByCategory(transactions: Transaction[]): CategoryTotal[] {
    const totals = new Map<string, CategoryTotal>();

    for (const transaction of transactions) {
      const categoryName = transaction.category?.name || 'Uncategorized';
      const existing = totals.get(categoryName) || {
        categoryName,
        income: 0,
        expense: 0,
        count: 0,
      };
      if (transaction.type === 'INCOME') {
        existing.income += transaction.value;
      } else {
        existing.expense += transaction.value;
      }
      existing.count += 1;
      totals.set(categoryName, existing);
    }

    return Array.from(totals.values()).sort(
      (a, b) => b.expense - a.expense || b.income - a.income,
    );
  }

  private buildCsv(transactions: Transaction[]): string {
    const rows = transactions.map((transaction) => ({
      date: format(new Date(transaction.date), 'yyyy-MM-dd'),
      description: transaction.description,
      value: transaction.value,
      type: transaction.type,
      categoryName: transaction.category?.name || '',
    }));

    return parse(rows, {
      fields: ['date', 'description', 'value', 'type', 'categoryName'],
    });
  }

  private buildReportText(report: MonthlyReport): string {
    const categoryLines = report.categories.map(
      (category) =>
        `${category.categoryName}: ${this.formatAmount(
          category.expense,
        )} spent, ${this.formatAmount(category.income)} received (${
          category.count
        } ${category.count === 1 ? 'transaction' : 'transactions'})`,
    );

    return [
      `Your expense report for ${report.monthLabel}`,
      '',
      `Total income: ${this.formatAmount(report.totalIncome)}`,
      `Total expenses: ${this.formatAmount(report.totalExpense)}`,
      `Net: ${this.formatAmount(report.net)}`,
      `Transactions: ${report.transactionCount}`,
      `Spending vs previous month: ${this.formatChange(report)}`,
      '',
      'By category:',
      ...categoryLines,
      '',
      'The full transaction list is attached as a CSV file.',
      '',
      'Best regards,',
      'The My Expenses Team',
    ].join('\n');
  }

  private buildReportHtml(report: MonthlyReport): string {
    const categoryRows = report.categories
      .map(
        (category) => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #eee;">${this.escapeHtml(
              category.categoryName,
            )}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${this.formatAmount(
              category.expense,
            )}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${this.formatAmount(
              category.income,
            )}</td>
            <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${
              category.count
            }</td>
          </tr>`,
      )
      .join('');

    return `
      <div style="font-family: Arial, sans-serif; color: #222; max-width: 640px; margin: 0 auto;">
        <h2 style="margin-bottom: 4px;">Your expense report for ${this.escapeHtml(
          report.monthLabel,
        )}</h2>
        <p style="color: #666; margin-top: 0;">${
          report.transactionCount
        } transactions</p>
        <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
          <tr>
            <td style="padding: 8px; background: #f4f4f4;">Total income</td>
            <td style="padding: 8px; background: #f4f4f4; text-align: right;">${this.formatAmount(
              report.totalIncome,
            )}</td>
          </tr>
          <tr>
            <td style="padding: 8px;">Total expenses</td>
            <td style="padding: 8px; text-align: right;">${this.formatAmount(
              report.totalExpense,
            )}</td>
          </tr>
          <tr>
            <td style="padding: 8px; background: #f4f4f4; font-weight: bold;">Net</td>
            <td style="padding: 8px; background: #f4f4f4; text-align: right; font-weight: bold;">${this.formatAmount(
              report.net,
            )}</td>
          </tr>
          <tr>
            <td style="padding: 8px;">Spending vs previous month</td>
            <td style="padding: 8px; text-align: right;">${this.formatChange(
              report,
            )}</td>
          </tr>
        </table>
        <h3>By category</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Category</th>
              <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ddd;">Spent</th>
              <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ddd;">Received</th>
              <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ddd;">Count</th>
            </tr>
          </thead>
          <tbody>${categoryRows}</tbody>
        </table>
        <p style="margin-top: 24px;">The full transaction list is attached as a CSV file.</p>
        <p style="margin-top: 32px;">Best regards,<br>The My Expenses Team</p>
      </div>
    `;
  }

  private formatChange(report: MonthlyReport): string {
    if (report.expenseTrend === 'stable') {
      return 'about the same';
    }
    const direction = report.expenseTrend === 'up' ? 'more' : 'less';
    return `${Math.abs(report.expenseChangePercentage).toFixed(
      1,
    )}% ${direction}`;
  }

  private formatAmount(value: number): string {
    return ilsFormatter.format(value);
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export default new MonthlyReportService();
