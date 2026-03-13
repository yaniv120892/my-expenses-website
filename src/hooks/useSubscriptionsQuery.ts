import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSubscriptions,
  confirmSubscription,
  dismissSubscription,
  convertToScheduled,
} from "../services/subscriptionService";
import { scheduledTransactionKeys } from "./useScheduledTransactionsQuery";

export const subscriptionKeys = {
  all: ["subscriptions"] as const,
  list: (status?: string) => [...subscriptionKeys.all, "list", status] as const,
};

export const useSubscriptionsQuery = (status?: string) => {
  return useQuery({
    queryKey: subscriptionKeys.list(status),
    queryFn: () => fetchSubscriptions(status),
  });
};

export const useConfirmSubscriptionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => confirmSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
};

export const useDismissSubscriptionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => dismissSubscription(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
    },
  });
};

export const useConvertSubscriptionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string }) =>
      convertToScheduled(id, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      queryClient.invalidateQueries({
        queryKey: scheduledTransactionKeys.all,
      });
    },
  });
};
