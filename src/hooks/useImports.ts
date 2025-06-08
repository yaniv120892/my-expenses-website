import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { importService } from "../services/importService";
import { Import } from "../types/import";
import { pendingTransactionKeys } from "@/hooks/usePendingTransactionsQuery";
import { transactionKeys } from "@/hooks/useTransactionsQuery";
import { trendKeys } from "@/hooks/useTrendsQuery";
import { CreateTransactionInput } from "../types";

export const useImportsQuery = () => {
  return useQuery<Import[]>({
    queryKey: ["imports"],
    queryFn: () => importService.getImports(),
  });
};

export const useImportedTransactionsQuery = (importId: string) => {
  return useQuery({
    queryKey: ["imported-transactions", importId],
    queryFn: () => importService.getImportedTransactions(importId),
    enabled: !!importId,
  });
};

export const useProcessImportMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      fileUrl,
      originalFileName,
      paymentMonth,
    }: {
      fileUrl: string;
      originalFileName: string;
      paymentMonth?: string;
    }) => importService.processImport(fileUrl, originalFileName, paymentMonth),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["imports"] });
    },
  });
};

export const useApproveImportedTransactionMutation = (importId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: CreateTransactionInput }) =>
      importService.approveImportedTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["imported-transactions", importId],
      });
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

export const useIgnoreImportedTransactionMutation = (importId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId: string) =>
      importService.ignoreImportedTransaction(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["imported-transactions", importId],
      });
    },
  });
};

export const useMergeImportedTransactionMutation = (importId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: CreateTransactionInput }) =>
      importService.mergeImportedTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["imported-transactions", importId],
      });
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

export const useDeleteImportedTransactionMutation = (importId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transactionId: string) =>
      importService.deleteImportedTransaction(transactionId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["imported-transactions", importId],
      });
    },
  });
};
