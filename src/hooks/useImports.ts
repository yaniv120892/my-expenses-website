import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { importService } from "../services/importService";
import { Import, BatchActionRequest, AutoApproveRule } from "../types/import";
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

export const useDeleteImportMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (importId: string) => importService.deleteImport(importId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["imports"] });
    },
  });
};

export const useRematchImportMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (importId: string) => importService.rematchImport(importId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["imports"] });
      queryClient.invalidateQueries({
        queryKey: ["imported-transactions"],
      });
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

export const useBatchActionMutation = (importId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: BatchActionRequest) =>
      importService.batchAction(request),
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

export const useApplyAutoApproveRulesMutation = (importId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => importService.applyAutoApproveRules(importId),
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

export const useAutoApproveRulesQuery = () => {
  return useQuery<AutoApproveRule[]>({
    queryKey: ["auto-approve-rules"],
    queryFn: () => importService.getAutoApproveRules(),
  });
};

export const useCreateAutoApproveRuleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      data: Pick<AutoApproveRule, "descriptionPattern" | "categoryId" | "type">
    ) => importService.createAutoApproveRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-approve-rules"] });
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
      queryClient.invalidateQueries({ queryKey: ["auto-approve-rules"] });
    },
  });
};

export const useDeleteAutoApproveRuleMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) =>
      importService.deleteAutoApproveRule(ruleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-approve-rules"] });
    },
  });
};

export function useImportUploadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      formData,
      onProgress,
    }: {
      formData: FormData;
      onProgress?: (progress: number) => void;
    }) => {
      return new Promise<{ fileUrl: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/imports/upload");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress((e.loaded / e.total) * 100);
          }
        };
        xhr.onload = () => {
          if (xhr.status === 200) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error("Invalid server response"));
            }
          } else {
            reject(
              new Error(xhr.responseText || `Upload failed (${xhr.status})`)
            );
          }
        };
        xhr.onerror = () => {
          reject(
            new Error(
              `Network error during upload (readyState: ${xhr.readyState}, status: ${xhr.status})`
            )
          );
        };
        xhr.timeout = 120000;
        xhr.ontimeout = () => {
          reject(
            new Error(
              "Upload timed out — please check your connection and try again"
            )
          );
        };
        xhr.send(formData);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
