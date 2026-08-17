import api from './api';
import { filenameFromContentDisposition } from '@/utils/download';
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

/**
 * A blob response type applies to errors too, so a failure arrives as a Blob
 * of JSON rather than a readable message. Reading it back is the only way the
 * server's reason (an export too large to build, say) reaches the user.
 */
async function messageFromBlobError(error: unknown): Promise<string | null> {
  const body = (error as { response?: { data?: unknown } })?.response?.data;
  if (!(body instanceof Blob)) return null;
  try {
    const { message, error: errorText } = JSON.parse(await body.text());
    return message ?? errorText ?? null;
  } catch {
    return null;
  }
}

/**
 * Built from the same filters as the list, so the file holds exactly the rows
 * the page describes — every one of them, not just the pages fetched so far.
 */
export async function exportTransactionsCsv(
  params?: TransactionFilters,
): Promise<{ blob: Blob; fileName: string }> {
  const res = await api
    .get('/api/transactions/export', {
      params: listFilters(params),
      responseType: 'blob',
    })
    .catch(async (error) => {
      const message = await messageFromBlobError(error);
      throw message ? new Error(message) : error;
    });
  return {
    blob: res.data,
    fileName: filenameFromContentDisposition(
      res.headers['content-disposition'],
      'transactions.csv',
    ),
  };
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
