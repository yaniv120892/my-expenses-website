import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createApiToken,
  getApiTokens,
  revokeApiToken,
} from '@/services/apiTokenService';

export const apiTokenKeys = {
  all: ['apiTokens'] as const,
  list: () => [...apiTokenKeys.all, 'list'] as const,
};

export const useApiTokensQuery = () =>
  useQuery({
    queryKey: apiTokenKeys.list(),
    queryFn: getApiTokens,
  });

export const useCreateApiTokenMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createApiToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiTokenKeys.list() });
    },
  });
};

export const useRevokeApiTokenMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeApiToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiTokenKeys.list() });
    },
  });
};
