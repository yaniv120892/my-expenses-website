import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  changeMemberRole,
  createInvite,
  getHousehold,
  joinHousehold,
  leaveHousehold,
  previewInvite,
  removeMember,
  revokeInvite,
} from '@/services/householdService';

export const householdKeys = {
  all: ['household'] as const,
  detail: () => [...householdKeys.all, 'detail'] as const,
  preview: (code: string) => [...householdKeys.all, 'preview', code] as const,
};

export const useHouseholdQuery = () =>
  useQuery({ queryKey: householdKeys.detail(), queryFn: getHousehold });

export const useInvitePreviewQuery = (code: string) =>
  useQuery({
    queryKey: householdKeys.preview(code),
    queryFn: () => previewInvite(code),
    enabled: code !== '',
    retry: false,
  });

export const useCreateInviteMutation = () => useHouseholdMutation(createInvite);
export const useRevokeInviteMutation = () => useHouseholdMutation(revokeInvite);
export const useChangeMemberRoleMutation = () => useHouseholdMutation(changeMemberRole);
export const useRemoveMemberMutation = () => useHouseholdMutation(removeMember);

export const useJoinHouseholdMutation = () => useMembershipChangeMutation(joinHousehold);
export const useLeaveHouseholdMutation = () => useMembershipChangeMutation(leaveHousehold);

function useHouseholdMutation<Variables, Result>(
  mutationFn: (variables: Variables) => Promise<Result>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: householdKeys.all }),
  });
}

/** Joining or leaving swaps every household-scoped answer, so the whole cache goes. */
function useMembershipChangeMutation<Variables>(
  mutationFn: (variables: Variables) => Promise<void>,
) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => queryClient.clear() });
}
