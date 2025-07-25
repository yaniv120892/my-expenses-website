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
    perPage: 1000,
    endDate: new Date(
      new Date().setDate(new Date().getDate() + 7)
    ).toISOString(),
  };
  // Explicitly include smartSearch if present
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

export async function getPendingTransactions(): Promise<Transaction[]> {
  const res = await api.get("/api/transactions/pending");
  return res.data;
}

export async function updateTransactionStatus(
  id: string,
  status: string
): Promise<string> {
  const res = await api.patch(`/api/transactions/${id}/status`, { status });
  return res.data;
}
