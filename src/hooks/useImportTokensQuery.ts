import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createImportToken,
  getImportTokens,
  revokeImportToken,
} from '@/services/importTokenService';

export const importTokenKeys = {
  all: ['importTokens'] as const,
  list: () => [...importTokenKeys.all, 'list'] as const,
};

export const useImportTokensQuery = () =>
  useQuery({
    queryKey: importTokenKeys.list(),
    queryFn: getImportTokens,
  });

export const useCreateImportTokenMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createImportToken(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: importTokenKeys.list() });
    },
  });
};

export const useRevokeImportTokenMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tokenId: string) => revokeImportToken(tokenId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: importTokenKeys.list() });
    },
  });
};
