import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPendingTransactions,
  updateTransactionStatus,
  deleteTransaction,
} from "../services/transactions";
import { trendKeys } from "@/hooks/useTrendsQuery";
import { transactionKeys } from "@/hooks/useTransactionsQuery";

export const pendingTransactionKeys = {
  all: ["pendingTransactions"] as const,
  lists: () => [...pendingTransactionKeys.all, "list"] as const,
};

export const usePendingTransactionsQuery = () => {
  return useQuery({
    queryKey: pendingTransactionKeys.lists(),
    queryFn: getPendingTransactions,
  });
};

export const useConfirmTransactionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => updateTransactionStatus(id, "APPROVED"),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: pendingTransactionKeys.lists(),
      });
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: transactionKeys.allTransactions(),
      });
      queryClient.invalidateQueries({ queryKey: transactionKeys.summary() });
      queryClient.invalidateQueries({ queryKey: trendKeys.all });
    },
  });
};

export const useDeletePendingTransactionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: pendingTransactionKeys.lists(),
      });
      queryClient.invalidateQueries({ queryKey: transactionKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: transactionKeys.allTransactions(),
      });
      queryClient.invalidateQueries({ queryKey: transactionKeys.summary() });
      queryClient.invalidateQueries({ queryKey: trendKeys.all });
    },
  });
};
