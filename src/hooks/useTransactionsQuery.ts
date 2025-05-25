import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from "@tanstack/react-query";
import {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getCategories,
  getTransactionSummary,
} from "../services/transactions";
import {
  TransactionFilters,
  CreateTransactionInput,
  UpdateTransactionInput,
  Transaction,
  TransactionSummary,
} from "../types";
import { trendKeys } from "@/hooks/useTrendsQuery";

export const transactionKeys = {
  all: ["transactions"] as const,
  lists: () => [...transactionKeys.all, "list"] as const,
  list: (filters: TransactionFilters) =>
    [...transactionKeys.lists(), filters] as const,
  categories: () => [...transactionKeys.all, "categories"] as const,
  allTransactions: () => [...transactionKeys.all, "allTransactions"] as const,
  summary: (filters?: Omit<TransactionFilters, "page" | "perPage">) =>
    [...transactionKeys.all, "summary", filters] as const,
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
    },
  });
};

export const useAllTransactionsQuery = (
  filters?: Omit<TransactionFilters, "page" | "limit">
) => {
  return useInfiniteQuery<Transaction[]>({
    queryKey: transactionKeys.allTransactions(),
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const response = await getTransactions({
        ...filters,
        page: pageParam as number,
        perPage: 100,
      });
      return response;
    },
    getNextPageParam: (lastPage: Transaction[], allPages) => {
      if (!lastPage || lastPage.length < 100) return undefined;
      return allPages.length + 1;
    },
    select: (data) => ({
      pages: data.pages,
      pageParams: data.pageParams,
      allTransactions: data.pages.flat(),
    }),
  });
};

export const useTransactionsSummaryQuery = (
  filters?: Omit<TransactionFilters, "page" | "perPage">
) => {
  return useQuery<TransactionSummary>({
    queryKey: transactionKeys.summary(filters),
    queryFn: () => getTransactionSummary(filters),
  });
};
