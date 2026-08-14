import api from './api';
import {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionSummary,
  TransactionFilters,
  Category,
} from '../types';

// getTransactionsSchema caps perPage at 100, so an unpaginated caller walks
// pages the way the server's own getAllTransactions does. MAX_PAGES keeps a
// server that always returns a full page from hanging the browser.
const MAX_PER_PAGE = 100;
const MAX_PAGES = 50;

/** Params every page of a list request shares, minus page/perPage. */
function listFilters(params?: TransactionFilters) {
  const { page: _page, perPage: _perPage, ...filters } = params ?? {};
  return {
    endDate: new Date(
      new Date().setDate(new Date().getDate() + 7),
    ).toISOString(),
    ...filters,
  };
}

async function fetchTransactionsPage(
  filters: ReturnType<typeof listFilters>,
  page: number,
  perPage: number,
): Promise<Transaction[]> {
  const res = await api.get('/api/transactions', {
    params: { ...filters, page, perPage },
  });
  return res.data;
}

export async function getTransactions(
  params?: TransactionFilters,
): Promise<Transaction[]> {
  const filters = listFilters(params);
  const perPage = Math.min(params?.perPage ?? MAX_PER_PAGE, MAX_PER_PAGE);

  // An explicit page means the caller wants that one page, not everything.
  if (params?.page !== undefined) {
    return fetchTransactionsPage(filters, params.page, perPage);
  }

  const transactions: Transaction[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await fetchTransactionsPage(filters, page, perPage);
    transactions.push(...batch);
    if (batch.length < perPage) break;
  }
  return transactions;
}

export async function getTransactionSummary(params?: {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  type?: string;
}): Promise<TransactionSummary> {
  const res = await api.get('/api/transactions/summary', { params });
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
