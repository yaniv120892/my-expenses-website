export type TrendPeriod = "weekly" | "monthly" | "yearly";
export type TransactionType = "EXPENSE" | "INCOME";

export type TrendPoint = {
  date: string;
  amount: number;
  count: number;
};

export type CategoryTrendPoint = TrendPoint & {
  categoryId: string;
  categoryName: string;
};

export interface SpendingTrend {
  points: {
    date: string;
    amount: number;
  }[];
  totalAmount: number;
  percentageChange: number;
  trend: "up" | "down" | "stable";
}

export interface CategorySpendingTrend extends SpendingTrend {
  categoryId: string;
  categoryName: string;
}

export interface TrendFilters {
  period: TrendPeriod;
  startDate: Date;
  endDate: Date;
  selectedCategory: string;
  transactionType: TransactionType;
}
