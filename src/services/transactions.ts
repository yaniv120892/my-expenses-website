import api from './api';
import {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionSummary,
  TransactionFilters,
  Category,
} from '../types';

export const TRANSACTIONS_PAGE_SIZE = 50;

/**
 * The one place list and summary filters are built. Both requests must send
 * the same window, or the totals would describe different rows than the list.
 */
function listFilters(params?: TransactionFilters) {
  return {
    endDate: new Date(
      new Date().setDate(new Date().getDate() + 7),
    ).toISOString(),
    ...params,
  };
}

export interface TransactionsPage {
  items: Transaction[];
  nextCursor: string | null;
}

export async function getTransactionsPage(
  params?: TransactionFilters,
  cursor?: string,
  limit: number = TRANSACTIONS_PAGE_SIZE,
): Promise<TransactionsPage> {
  const res = await api.get('/api/transactions', {
    params: { ...listFilters(params), cursor, limit },
  });
  return res.data;
}

export async function getTransactionSummary(
  params?: TransactionFilters,
): Promise<TransactionSummary> {
  const res = await api.get('/api/transactions/summary', {
    params: listFilters(params),
  });
  return res.data;
}

export interface CreateTransactionResponse {
  id: string;
  suggestedCategory?: {
    id: string;
    name: string;
  };
}

export async function createTransaction(
  data: CreateTransactionInput,
): Promise<CreateTransactionResponse> {
  const res = await api.post('/api/transactions', data);
  return res.data;
}

export async function updateTransaction(
  id: string,
  data: UpdateTransactionInput,
): Promise<string> {
  const res = await api.put(`/api/transactions/${id}`, data);
  return res.data;
}

export async function deleteTransaction(id: string): Promise<void> {
  await api.delete(`/api/transactions/${id}`);
}

export async function getCategories(): Promise<Category[]> {
  const res = await api.get('/api/categories');
  return res.data;
}

export async function getPendingTransactions(): Promise<Transaction[]> {
  const res = await api.get('/api/transactions/pending');
  return res.data;
}

export async function updateTransactionStatus(
  id: string,
  status: string,
): Promise<string> {
  const res = await api.patch(`/api/transactions/${id}/status`, { status });
  return res.data;
}
