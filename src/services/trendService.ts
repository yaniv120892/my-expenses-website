import {
  TrendPeriod,
  SpendingTrend,
  CategorySpendingTrend,
  CategoryComparison,
  ComparisonScope,
  TransactionType,
} from '@/types/trends';
import api from './api';
import { toDayString } from '@/shared/dates';

interface GetTrendsParams {
  startDate?: Date;
  endDate?: Date;
  period: TrendPeriod;
  categoryId?: string;
  transactionType?: TransactionType;
}

export interface GetComparisonParams {
  startDate: Date;
  endDate: Date;
  period: TrendPeriod;
  categoryIds: string[];
  scope: ComparisonScope;
  transactionType?: TransactionType;
}

export async function fetchSpendingTrends(
  params: GetTrendsParams,
): Promise<SpendingTrend> {
  const queryParams = {
    ...(params.startDate && {
      startDate: toDayString(params.startDate),
    }),
    ...(params.endDate && { endDate: toDayString(params.endDate) }),
    period: params.period,
    ...(params.categoryId && { categoryId: params.categoryId }),
    ...(params.transactionType && { transactionType: params.transactionType }),
  };

  const res = await api.get('/api/trends', { params: queryParams });
  return res.data;
}

export async function fetchCategorySpendingTrends(
  params: GetTrendsParams,
): Promise<CategorySpendingTrend[]> {
  const queryParams = {
    ...(params.startDate && {
      startDate: toDayString(params.startDate),
    }),
    ...(params.endDate && { endDate: toDayString(params.endDate) }),
    period: params.period,
    ...(params.transactionType && { transactionType: params.transactionType }),
  };

  const res = await api.get('/api/trends/categories', { params: queryParams });
  return res.data;
}

export async function fetchCategoryComparison(
  params: GetComparisonParams,
): Promise<CategoryComparison> {
  const queryParams = {
    startDate: toDayString(params.startDate),
    endDate: toDayString(params.endDate),
    period: params.period,
    // Comma-joined, not repeated params: the API flattens searchParams and
    // would keep only the last value of a repeated key.
    categoryIds: params.categoryIds.join(','),
    scope: params.scope,
    ...(params.transactionType && { transactionType: params.transactionType }),
  };

  const res = await api.get('/api/trends/comparison', { params: queryParams });
  return res.data;
}
