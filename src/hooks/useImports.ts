import { useRef } from 'react';
import {
  QueryClient,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { importService } from '@/services/importService';
import { Import, BatchActionRequest, AutoApproveRule } from '@/types/import';
import { CreateTransactionInput } from '@/types';
import { invalidateTransactionData } from '@/hooks/queryInvalidation';
import {
  hasActiveImports,
  IMPORTS_POLL_INTERVAL_MS,
  MAX_ACTIVE_POLL_MS,
} from '@/utils/importStatus';

export const importKeys = {
  all: ['imports'] as const,
  lists: () => [...importKeys.all, 'list'] as const,
  transactions: (importId: string) =>
    [...importKeys.all, 'transactions', importId] as const,
  allTransactions: () => [...importKeys.all, 'transactions'] as const,
  autoApproveRules: () => [...importKeys.all, 'auto-approve-rules'] as const,
};

export const useImportsQuery = () => {
  const watchingSince = useRef<number | null>(null);

  return useQuery<Import[]>({
    queryKey: importKeys.lists(),
    queryFn: () => importService.getImports(),
    // Overrides the global 60s: extraction completes on a webhook, so a cached
    // status goes stale without the client doing anything.
    staleTime: 0,
    refetchInterval: (query) => {
      if (!hasActiveImports(query.state.data)) {
        watchingSince.current = null;
        return false;
      }

      watchingSince.current ??= Date.now();
      const watchedFor = Date.now() - watchingSince.current;

      return watchedFor < MAX_ACTIVE_POLL_MS ? IMPORTS_POLL_INTERVAL_MS : false;
    },
  });
};

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
      invalidateImportRows(queryClient, importId);
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
      invalidateImportRows(queryClient, importId);
    },
  });
};

export const useMergeImportedTransactionMutation = (importId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: CreateTransactionInput }) =>
      importService.mergeImportedTransaction(id, data),
    onSuccess: () => {
      invalidateImportRows(queryClient, importId);
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
      invalidateImportRows(queryClient, importId);
    },
  });
};

export const useBatchActionMutation = (importId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: BatchActionRequest) =>
      importService.batchAction(request),
    onSuccess: () => {
      invalidateImportRows(queryClient, importId);
      invalidateTransactionData(queryClient);
    },
  });
};

export const useApplyAutoApproveRulesMutation = (importId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => importService.applyAutoApproveRules(importId),
    onSuccess: () => {
      invalidateImportRows(queryClient, importId);
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

// An import's `isVerified` is derived from its pending rows, so the list goes stale with them.
function invalidateImportRows(queryClient: QueryClient, importId: string) {
  queryClient.invalidateQueries({
    queryKey: importKeys.transactions(importId),
  });
  queryClient.invalidateQueries({ queryKey: importKeys.lists() });
}
