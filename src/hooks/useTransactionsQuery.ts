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
  exportTransactionsCsv,
} from '@/services/transactions';
import { downloadBlob } from '@/utils/download';
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
  summary: (filters?: TransactionFilters) =>
    [...transactionKeys.summaries(), filters] as const,
};

export const useTransactionsInfiniteQuery = (filters?: TransactionFilters) => {
  return useInfiniteQuery({
    queryKey: transactionKeys.list(filters || {}),
    queryFn: ({ pageParam }) => getTransactionsPage(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
};

// A mutation rather than a query: the file is an action's result, not state
// worth caching, and isPending is exactly the button's disabled condition.
export const useExportTransactionsCsvMutation = () => {
  return useMutation({
    mutationFn: (filters?: TransactionFilters) =>
      exportTransactionsCsv(filters),
    onSuccess: ({ blob, fileName }) => downloadBlob(fileName, blob),
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
