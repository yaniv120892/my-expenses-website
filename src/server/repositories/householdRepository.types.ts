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

/** A member moved to a household of their own, and the API tokens that went with the move. */
export type MemberMove = {
  apiTokensRevoked: number;
};
