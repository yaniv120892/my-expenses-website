import type { HouseholdRole } from '@/generated/prisma/enums';

export type HouseholdMemberRow = {
  id: string;
  username: string;
  email: string;
  householdRole: HouseholdRole;
};

export type PendingInviteRow = {
  id: string;
  code: string;
  role: HouseholdRole;
  expiresAt: Date;
  createdAt: Date;
};

export type MemberMove = {
  apiTokensRevoked: number;
};
