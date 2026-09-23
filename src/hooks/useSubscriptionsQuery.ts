import {
  QueryClient,
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  fetchSubscriptions,
  confirmSubscription,
  dismissSubscription,
  updateSubscription,
  convertToScheduled,
} from '../services/subscriptionService';
import { UpdateSubscriptionPayload } from '../types/subscription';
import { scheduledTransactionKeys } from './useScheduledTransactionsQuery';
import { dashboardKeys } from './useDashboardQuery';

export const subscriptionKeys = {
  all: ['subscriptions'] as const,
  list: (status?: string) => [...subscriptionKeys.all, 'list', status] as const,
};

export const useSubscriptionsQuery = (status?: string) => {
  return useQuery({
    queryKey: subscriptionKeys.list(status),
    queryFn: () => fetchSubscriptions(status),
    placeholderData: keepPreviousData,
  });
};

export const useConfirmSubscriptionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => confirmSubscription(id),
    onSuccess: () => {
      invalidateSubscriptionData(queryClient);
    },
  });
};

export const useDismissSubscriptionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => dismissSubscription(id),
    onSuccess: () => {
      invalidateSubscriptionData(queryClient);
    },
  });
};

export const useUpdateSubscriptionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateSubscriptionPayload;
    }) => updateSubscription(id, payload),
    onSuccess: () => {
      invalidateSubscriptionData(queryClient);
    },
  });
};

export const useConvertSubscriptionMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId?: string }) =>
      convertToScheduled(id, categoryId),
    onSuccess: () => {
      invalidateSubscriptionData(queryClient);
      queryClient.invalidateQueries({
        queryKey: scheduledTransactionKeys.all,
      });
    },
  });
};

// The dashboard carries a subscriptions card, so every change here reaches it.
function invalidateSubscriptionData(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
  queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
}
