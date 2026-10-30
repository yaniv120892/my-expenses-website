import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import type { HouseholdActivityPage } from '@/shared/types/householdActivity';
import {
  changeMemberRole,
  createInvite,
  getHousehold,
  getHouseholdActivity,
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
  activity: () => [...householdKeys.all, 'activity'] as const,
};

export const useHouseholdQuery = () =>
  useQuery({ queryKey: householdKeys.detail(), queryFn: getHousehold });

export const useHouseholdActivityQuery = () =>
  useInfiniteQuery<
    HouseholdActivityPage,
    Error,
    InfiniteData<HouseholdActivityPage, string | null>,
    ReturnType<typeof householdKeys.activity>,
    string | null
  >({
    queryKey: householdKeys.activity(),
    queryFn: ({ pageParam }) => getHouseholdActivity(pageParam),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

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
