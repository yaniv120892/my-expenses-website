import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getCategories,
  getTransactionSummary,
} from '@/services/transactions';
import {
  TransactionFilters,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionSummary,
} from '@/types';
import { invalidateTransactionData } from '@/hooks/queryInvalidation';

export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (filters: TransactionFilters) =>
    [...transactionKeys.lists(), filters] as const,
  categories: () => [...transactionKeys.all, 'categories'] as const,
  allTransactions: () => [...transactionKeys.all, 'allTransactions'] as const,
  // Prefix without the filters argument, so invalidation matches every
  // filtered summary query.
  summaries: () => [...transactionKeys.all, 'summary'] as const,
  summary: (filters?: Omit<TransactionFilters, 'page' | 'perPage'>) =>
    [...transactionKeys.summaries(), filters] as const,
};

export const useTransactionsQuery = (filters?: TransactionFilters) => {
  return useQuery({
    queryKey: transactionKeys.list(filters || {}),
    queryFn: () => getTransactions(filters),
  });
};

export const useCategoriesQuery = () => {
  return useQuery({
    queryKey: transactionKeys.categories(),
    queryFn: getCategories,
  });
};

export const useCreateTransactionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTransactionInput) => createTransaction(data),
    onSuccess: () => invalidateTransactionData(queryClient),
  });
};

export const useUpdateTransactionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTransactionInput }) =>
      updateTransaction(id, data),
    onSuccess: () => invalidateTransactionData(queryClient),
  });
};

export const useDeleteTransactionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => invalidateTransactionData(queryClient),
  });
};

export const useTransactionsSummaryQuery = (
  filters?: Omit<TransactionFilters, 'page' | 'perPage'>,
) => {
  return useQuery<TransactionSummary>({
    queryKey: transactionKeys.summary(filters),
    queryFn: () => getTransactionSummary(filters),
  });
};
