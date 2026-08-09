import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getCategories,
  getTransactionSummary,
} from '../services/transactions';
import {
  TransactionFilters,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionSummary,
} from '../types';
import { trendKeys } from '@/hooks/useTrendsQuery';
import { dashboardKeys } from '@/hooks/useDashboardQuery';

export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (filters: TransactionFilters) =>
    [...transactionKeys.lists(), filters] as const,
  categories: () => [...transactionKeys.all, 'categories'] as const,
  allTransactions: () => [...transactionKeys.all, 'allTransactions'] as const,
  summary: (filters?: Omit<TransactionFilters, 'page' | 'perPage'>) =>
    [...transactionKeys.all, 'summary', filters] as const,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: transactionKeys.allTransactions(),
      });
      queryClient.invalidateQueries({ queryKey: transactionKeys.summary() });
      queryClient.invalidateQueries({ queryKey: trendKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
};

export const useUpdateTransactionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTransactionInput }) =>
      updateTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: transactionKeys.allTransactions(),
      });
      queryClient.invalidateQueries({ queryKey: transactionKeys.summary() });
      queryClient.invalidateQueries({ queryKey: trendKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
};

export const useDeleteTransactionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: transactionKeys.allTransactions(),
      });
      queryClient.invalidateQueries({ queryKey: transactionKeys.summary() });
      queryClient.invalidateQueries({ queryKey: trendKeys.all });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
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
