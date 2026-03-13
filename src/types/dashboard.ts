export interface SubscriptionSnapshot {
  activeCount: number;
  totalMonthlyEstimate: number;
  totalAnnualEstimate: number;
  detectedCount: number;
}

export interface DashboardResponse {
  monthComparison: MonthComparison;
  topCategories: TopCategory[];
  recentTransactions: RecentTransaction[];
  subscriptions?: SubscriptionSnapshot;
}

export interface DashboardInsightsResponse {
  unusualSpending: string[];
  summary: string;
}

export interface MonthComparison {
  currentMonth: MonthSummary;
  previousMonth: MonthSummary;
  incomeChange: PercentageChange;
  expenseChange: PercentageChange;
  savingsChange: PercentageChange;
}

export interface MonthSummary {
  month: string;
  totalIncome: number;
  totalExpense: number;
  savings: number;
}

export interface PercentageChange {
  amount: number;
  percentage: number;
  trend: "up" | "down" | "stable";
}

export interface TopCategory {
  categoryId: string;
  categoryName: string;
  amount: number;
  percentage: number;
  previousMonthAmount: number;
  change: PercentageChange;
}

export interface RecentTransaction {
  id: string;
  description: string;
  value: number;
  date: string;
  type: "INCOME" | "EXPENSE";
  categoryName: string;
}
