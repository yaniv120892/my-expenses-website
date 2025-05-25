import { format } from "date-fns";
import {
  TrendPeriod,
  SpendingTrend,
  CategorySpendingTrend,
  TransactionType,
} from "@/types/trends";
import api from "./api";

interface GetTrendsParams {
  startDate?: Date;
  endDate?: Date;
  period: TrendPeriod;
  categoryId?: string;
  transactionType?: TransactionType;
}

export async function fetchSpendingTrends(
  params: GetTrendsParams
): Promise<SpendingTrend> {
  const queryParams = {
    ...(params.startDate && {
      startDate: format(params.startDate, "yyyy-MM-dd"),
    }),
    ...(params.endDate && { endDate: format(params.endDate, "yyyy-MM-dd") }),
    period: params.period,
    ...(params.categoryId && { categoryId: params.categoryId }),
    ...(params.transactionType && { transactionType: params.transactionType }),
  };

  const res = await api.get("/api/trends", { params: queryParams });
  return res.data;
}

export async function fetchCategorySpendingTrends(
  params: GetTrendsParams
): Promise<CategorySpendingTrend[]> {
  const queryParams = {
    ...(params.startDate && {
      startDate: format(params.startDate, "yyyy-MM-dd"),
    }),
    ...(params.endDate && { endDate: format(params.endDate, "yyyy-MM-dd") }),
    period: params.period,
    ...(params.transactionType && { transactionType: params.transactionType }),
  };

  const res = await api.get("/api/trends/categories", { params: queryParams });
  return res.data;
}
