import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createApiToken,
  getApiTokens,
  revokeApiToken,
} from '@/services/apiTokenService';
import type { ApiTokenScope } from '@/types/apiToken';

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
    mutationFn: (input: { name: string; scopes: ApiTokenScope[] }) =>
      createApiToken(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiTokenKeys.list() });
    },
  });
};

export const useRevokeApiTokenMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tokenId: string) => revokeApiToken(tokenId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiTokenKeys.list() });
    },
  });
};
