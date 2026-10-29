import api from './api';
import { filenameFromContentDisposition } from '@/utils/download';
import type {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionSummary,
  TransactionFilters,
  CategoryBreakdownItem,
  Category,
} from '../types';
import { DEFAULT_TRANSACTION_SORT, type TransactionSort } from '@/shared/schemas/transactions';

export const TRANSACTIONS_PAGE_SIZE = 50;

// List and summary must send the same window, or the totals would describe
// different rows than the list.
function listFilters(params?: TransactionFilters) {
  return {
    endDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString(),
    ...params,
  };
}

export type TransactionsPage = {
  items: Transaction[];
  nextCursor: string | null;
};

export async function getTransactionsPage(
  params?: TransactionFilters,
  cursor?: string,
  sort: TransactionSort = DEFAULT_TRANSACTION_SORT,
): Promise<TransactionsPage> {
  const response = await api.get('/api/transactions', {
    params: {
      ...listFilters(params),
      ...sort,
      cursor,
      limit: TRANSACTIONS_PAGE_SIZE,
    },
  });
  return response.data;
}

export async function getTransactionSummary(
  params?: TransactionFilters,
): Promise<TransactionSummary> {
  const response = await api.get('/api/transactions/summary', {
    params: listFilters(params),
  });
  return response.data;
}

export async function getCategoryBreakdown(
  params?: TransactionFilters,
): Promise<CategoryBreakdownItem[]> {
  const response = await api.get('/api/transactions/summary/categories', {
    params: listFilters(params),
  });
  return response.data;
}

// Every row the filters match, not just the pages fetched so far.
export async function exportTransactionsCsv(
  params?: TransactionFilters,
  sort: TransactionSort = DEFAULT_TRANSACTION_SORT,
): Promise<{ blob: Blob; fileName: string }> {
  const response = await api.get('/api/transactions/export', {
    params: { ...listFilters(params), ...sort },
    responseType: 'blob',
  });
  return {
    blob: response.data,
    fileName: filenameFromContentDisposition(
      response.headers['content-disposition'],
      'transactions.csv',
    ),
  };
}

export type CreateTransactionResponse = {
  id: string;
  suggestedCategory?: {
    id: string;
    name: string;
  };
};

export async function createTransaction(
  data: CreateTransactionInput,
): Promise<CreateTransactionResponse> {
  const response = await api.post('/api/transactions', data);
  return response.data;
}

export async function updateTransaction(id: string, data: UpdateTransactionInput): Promise<string> {
  const response = await api.put(`/api/transactions/${id}`, data);
  return response.data;
}

export async function deleteTransaction(id: string): Promise<void> {
  await api.delete(`/api/transactions/${id}`);
}

export async function getCategories(): Promise<Category[]> {
  const response = await api.get('/api/categories');
  return response.data;
}

export async function getPendingTransactions(): Promise<Transaction[]> {
  const response = await api.get('/api/transactions/pending');
  return response.data;
}

export async function updateTransactionStatus(id: string, status: string): Promise<string> {
  const response = await api.patch(`/api/transactions/${id}/status`, { status });
  return response.data;
}
