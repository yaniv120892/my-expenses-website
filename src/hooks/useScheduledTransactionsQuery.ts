import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getScheduledTransactions,
  createScheduledTransaction,
  updateScheduledTransaction,
  deleteScheduledTransaction,
} from "../services/scheduledTransactions";
import {
  CreateScheduledTransactionInput,
  UpdateScheduledTransactionInput,
} from "../types";

export const scheduledTransactionKeys = {
  all: ["scheduledTransactions"] as const,
  lists: () => [...scheduledTransactionKeys.all, "list"] as const,
};

export const useScheduledTransactionsQuery = () => {
  return useQuery({
    queryKey: scheduledTransactionKeys.lists(),
    queryFn: getScheduledTransactions,
  });
};

export const useCreateScheduledTransactionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateScheduledTransactionInput) =>
      createScheduledTransaction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: scheduledTransactionKeys.lists(),
      });
    },
  });
};

export const useUpdateScheduledTransactionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateScheduledTransactionInput;
    }) => updateScheduledTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: scheduledTransactionKeys.lists(),
      });
    },
  });
};

export const useDeleteScheduledTransactionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteScheduledTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: scheduledTransactionKeys.lists(),
      });
    },
  });
};
