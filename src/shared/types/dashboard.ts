import type { z } from 'zod';
import type { dashboardInsightsResponseSchema } from '@/shared/schemas/dashboard';

export type SubscriptionSnapshot = {
  activeCount: number;
  totalMonthlyEstimate: number;
  totalAnnualEstimate: number;
  detectedCount: number;
};

export type DashboardResponse = {
  monthComparison: MonthComparison;
  topCategories: TopCategory[];
  recentTransactions: RecentTransaction[];
  subscriptions?: SubscriptionSnapshot;
};

export type DashboardInsightsResponse = z.infer<typeof dashboardInsightsResponseSchema>;

export type MonthComparison = {
  currentMonth: MonthSummary;
  previousMonth: MonthSummary;
  incomeChange: PercentageChange;
  expenseChange: PercentageChange;
  savingsChange: PercentageChange;
};

export type MonthSummary = {
  month: string; // "YYYY-MM"
  totalIncome: number;
  totalExpense: number;
  savings: number;
};

export type PercentageChange = {
  amount: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
};

export type TopCategory = {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  previousMonthAmount: number;
  change: PercentageChange;
};

export type RecentTransaction = {
  id: string;
  description: string;
  value: number;
  date: string;
  type: 'INCOME' | 'EXPENSE';
  categoryName: string;
};
