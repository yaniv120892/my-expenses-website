import { useQuery } from "@tanstack/react-query";
import {
  fetchSpendingTrends,
  fetchCategorySpendingTrends,
} from "../services/trendService";
import { TrendPeriod, TransactionType } from "@/types/trends";

interface TrendParams {
  startDate?: Date;
  endDate?: Date;
  period: TrendPeriod;
  categoryId?: string;
  transactionType?: TransactionType;
}

export const trendKeys = {
  all: ["trends"] as const,
  overview: (params: TrendParams) =>
    [...trendKeys.all, "overview", params] as const,
  categories: (params: TrendParams) =>
    [...trendKeys.all, "categories", params] as const,
};

export const useSpendingTrendsQuery = (params: TrendParams) => {
  return useQuery({
    queryKey: trendKeys.overview(params),
    queryFn: () => fetchSpendingTrends(params),
  });
};

export const useCategorySpendingTrendsQuery = (params: TrendParams) => {
  return useQuery({
    queryKey: trendKeys.categories(params),
    queryFn: () => fetchCategorySpendingTrends(params),
  });
};
