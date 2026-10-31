import type {
  HouseholdInviteView,
  HouseholdView,
  InvitableRole,
  InvitePreview,
} from '@/shared/types/household';
import api from './api';

export async function getHousehold(): Promise<HouseholdView> {
  const response = await api.get<HouseholdView>('/api/household');
  return response.data;
}

export async function createInvite(role: InvitableRole): Promise<HouseholdInviteView> {
  const response = await api.post<HouseholdInviteView>('/api/household/invites', { role });
  return response.data;
}

export async function revokeInvite(inviteId: string): Promise<void> {
  await api.delete(`/api/household/invites/${inviteId}`);
}

export async function previewInvite(code: string): Promise<InvitePreview> {
  const response = await api.get<InvitePreview>('/api/household/invites/preview', {
    params: { code },
  });
  return response.data;
}

export async function joinHousehold(code: string): Promise<void> {
  await api.post('/api/household/join', { code });
}

export async function leaveHousehold(): Promise<void> {
  await api.post('/api/household/leave');
}

export async function changeMemberRole({
  memberId,
  role,
}: {
  memberId: string;
  role: InvitableRole;
}): Promise<void> {
  await api.patch(`/api/household/members/${memberId}`, { role });
}

export async function removeMember(memberId: string): Promise<void> {
  await api.delete(`/api/household/members/${memberId}`);
}
