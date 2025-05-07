import api from "./api";
import {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionSummary,
  TransactionFilters,
  Category,
} from "../types";

export async function getTransactions(
  params?: TransactionFilters
): Promise<Transaction[]> {
  const defaultParams = {
    page: 1,
    perPage: 10,
  };
  const mergedParams = { ...defaultParams, ...params };
  const res = await api.get("/api/transactions", { params: mergedParams });
  return res.data;
}

export async function getTransactionSummary(params?: {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  type?: string;
}): Promise<TransactionSummary> {
  const res = await api.get("/api/transactions/summary", { params });
  return res.data;
}

export async function createTransaction(
  data: CreateTransactionInput
): Promise<string> {
  const res = await api.post("/api/transactions", data);
  return res.data;
}

export async function updateTransaction(
  id: string,
  data: UpdateTransactionInput
): Promise<string> {
  const res = await api.put(`/api/transactions/${id}`, data);
  return res.data;
}

export async function deleteTransaction(id: string): Promise<void> {
  await api.delete(`/api/transactions/${id}`);
}

export async function getCategories(): Promise<Category[]> {
  const res = await api.get("/api/categories");
  return res.data;
}
