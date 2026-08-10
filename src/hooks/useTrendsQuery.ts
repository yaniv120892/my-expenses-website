import { useQuery } from '@tanstack/react-query';
import {
  fetchSpendingTrends,
  fetchCategorySpendingTrends,
  fetchCategoryComparison,
  GetComparisonParams,
} from '../services/trendService';
import { TrendPeriod, TransactionType } from '@/types/trends';

interface TrendParams {
  startDate?: Date;
  endDate?: Date;
  period: TrendPeriod;
  categoryId?: string;
  transactionType?: TransactionType;
}

export const trendKeys = {
  all: ['trends'] as const,
  overview: (params: TrendParams) =>
    [...trendKeys.all, 'overview', params] as const,
  categories: (params: TrendParams) =>
    [...trendKeys.all, 'categories', params] as const,
  comparison: (params: GetComparisonParams) =>
    [...trendKeys.all, 'comparison', params] as const,
};

export const useSpendingTrendsQuery = (params: TrendParams, enabled = true) => {
  return useQuery({
    queryKey: trendKeys.overview(params),
    queryFn: () => fetchSpendingTrends(params),
    enabled,
  });
};

export const useCategorySpendingTrendsQuery = (
  params: TrendParams,
  enabled = true,
) => {
  return useQuery({
    queryKey: trendKeys.categories(params),
    queryFn: () => fetchCategorySpendingTrends(params),
    enabled,
  });
};

export const useCategoryComparisonQuery = (
  params: GetComparisonParams,
  enabled = true,
) => {
  return useQuery({
    queryKey: trendKeys.comparison(params),
    queryFn: () => fetchCategoryComparison(params),
    enabled: enabled && params.categoryIds.length > 0,
  });
};
