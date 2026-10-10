import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  getTransactionsPage,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getCategories,
  getTransactionSummary,
  getCategoryBreakdown,
  exportTransactionsCsv,
} from '@/services/transactions';
import { downloadBlob } from '@/utils/download';
import {
  TransactionFilters,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionSummary,
  CategoryBreakdownItem,
} from '@/types';
import { invalidateTransactionData } from '@/hooks/queryInvalidation';
import type { TransactionSort } from '@/shared/schemas/transactions';

export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  list: (filters: TransactionFilters, sort: TransactionSort) =>
    [...transactionKeys.lists(), filters, sort] as const,
  categories: () => [...transactionKeys.all, 'categories'] as const,
  // Prefix without the filters argument, so invalidation matches every
  // filtered summary query.
  summaries: () => [...transactionKeys.all, 'summary'] as const,
  summary: (filters?: TransactionFilters) =>
    [...transactionKeys.summaries(), filters] as const,
  categoryBreakdown: (filters?: TransactionFilters) =>
    [...transactionKeys.summaries(), 'categories', filters] as const,
};

export const useTransactionsInfiniteQuery = (
  filters: TransactionFilters,
  sort: TransactionSort,
) => {
  return useInfiniteQuery({
    queryKey: transactionKeys.list(filters, sort),
    queryFn: ({ pageParam }) => getTransactionsPage(filters, pageParam, sort),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
};

// A mutation, not a query: the file is an action's result, not state worth
// caching, and the blob is saved and dropped inside mutationFn.
export const useExportTransactionsCsvMutation = () => {
  return useMutation({
    mutationFn: async ({
      filters,
      sort,
    }: {
      filters: TransactionFilters;
      sort: TransactionSort;
    }) => {
      const { blob, fileName } = await exportTransactionsCsv(filters, sort);
      downloadBlob(fileName, blob);
      return fileName;
    },
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

export const useTransactionsSummaryQuery = (filters?: TransactionFilters) => {
  return useQuery<TransactionSummary>({
    queryKey: transactionKeys.summary(filters),
    queryFn: () => getTransactionSummary(filters),
  });
};

export const useCategoryBreakdownQuery = (
  filters: TransactionFilters,
  enabled: boolean,
) => {
  return useQuery<CategoryBreakdownItem[]>({
    queryKey: transactionKeys.categoryBreakdown(filters),
    queryFn: () => getCategoryBreakdown(filters),
    enabled,
  });
};
