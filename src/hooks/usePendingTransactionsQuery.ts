import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPendingTransactions,
  updateTransactionStatus,
  deleteTransaction,
} from '@/services/transactions';
import { invalidateTransactionData } from '@/hooks/queryInvalidation';

export const pendingTransactionKeys = {
  all: ['pendingTransactions'] as const,
  lists: () => [...pendingTransactionKeys.all, 'list'] as const,
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
    mutationFn: (id: string) => updateTransactionStatus(id, 'APPROVED'),
    onSuccess: () => invalidateTransactionData(queryClient),
  });
};

export const useDeletePendingTransactionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => invalidateTransactionData(queryClient),
  });
};
