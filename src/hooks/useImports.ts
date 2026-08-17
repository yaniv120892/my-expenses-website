import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { importService } from '@/services/importService';
import { Import, BatchActionRequest, AutoApproveRule } from '@/types/import';
import { CreateTransactionInput } from '@/types';
import { invalidateTransactionData } from '@/hooks/queryInvalidation';
import {
  hasActiveImports,
  IMPORTS_POLL_INTERVAL_MS,
} from '@/utils/importStatus';

export const importKeys = {
  all: ['imports'] as const,
  lists: () => [...importKeys.all, 'list'] as const,
  transactions: (importId: string) =>
    [...importKeys.all, 'transactions', importId] as const,
  allTransactions: () => [...importKeys.all, 'transactions'] as const,
  autoApproveRules: () => [...importKeys.all, 'auto-approve-rules'] as const,
};

export const useImportsQuery = () =>
  useQuery<Import[]>({
    queryKey: importKeys.lists(),
    queryFn: () => importService.getImports(),
    // Extraction completes on a webhook, so an in-flight import only changes
    // server-side. staleTime overrides the global 60s so mount and focus
    // refetches are not served a stale status from cache.
    staleTime: 0,
    refetchInterval: (query) =>
      hasActiveImports(query.state.data) ? IMPORTS_POLL_INTERVAL_MS : false,
  });

export const useImportedTransactionsQuery = (importId: string) =>
  useQuery({
    queryKey: importKeys.transactions(importId),
    queryFn: () => importService.getImportedTransactions(importId),
    enabled: !!importId,
  });

export const useApproveImportedTransactionMutation = (importId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: CreateTransactionInput }) =>
      importService.approveImportedTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: importKeys.transactions(importId),
      });
      invalidateTransactionData(queryClient);
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
        queryKey: importKeys.transactions(importId),
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
        queryKey: importKeys.transactions(importId),
      });
      invalidateTransactionData(queryClient);
    },
  });
};

export const useDeleteImportMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (importId: string) => importService.deleteImport(importId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: importKeys.lists() });
    },
  });
};

export const useRematchImportMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (importId: string) => importService.rematchImport(importId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: importKeys.lists() });
      queryClient.invalidateQueries({ queryKey: importKeys.allTransactions() });
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
        queryKey: importKeys.transactions(importId),
      });
    },
  });
};

export const useBatchActionMutation = (importId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: BatchActionRequest) =>
      importService.batchAction(request),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: importKeys.transactions(importId),
      });
      invalidateTransactionData(queryClient);
    },
  });
};

export const useApplyAutoApproveRulesMutation = (importId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => importService.applyAutoApproveRules(importId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: importKeys.transactions(importId),
      });
      invalidateTransactionData(queryClient);
    },
  });
};

export const useAutoApproveRulesQuery = () =>
  useQuery<AutoApproveRule[]>({
    queryKey: importKeys.autoApproveRules(),
    queryFn: () => importService.getAutoApproveRules(),
  });

export const useCreateAutoApproveRuleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      data: Pick<AutoApproveRule, 'descriptionPattern' | 'categoryId' | 'type'>,
    ) => importService.createAutoApproveRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: importKeys.autoApproveRules(),
      });
    },
  });
};

export const useUpdateAutoApproveRuleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      ruleId,
      data,
    }: {
      ruleId: string;
      data: Partial<AutoApproveRule>;
    }) => importService.updateAutoApproveRule(ruleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: importKeys.autoApproveRules(),
      });
    },
  });
};

export const useDeleteAutoApproveRuleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => importService.deleteAutoApproveRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: importKeys.autoApproveRules(),
      });
    },
  });
};
