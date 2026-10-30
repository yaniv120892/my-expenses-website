import type { HouseholdRole } from '@/generated/prisma/enums';

/** An invite never makes a second owner: a household has exactly one. */
export type InvitableRole = Exclude<HouseholdRole, 'OWNER'>;

export type HouseholdMemberView = {
  id: string;
  username: string;
  email: string;
  role: HouseholdRole;
  isYou: boolean;
};

export type HouseholdInviteView = {
  id: string;
  code: string;
  role: InvitableRole;
  expiresAt: string;
  createdAt: string;
};

export type HouseholdView = {
  role: HouseholdRole;
  ownerName: string;
  members: HouseholdMemberView[];
  /** Pending invites; only the owner is shown them. */
  invites: HouseholdInviteView[];
};

/**
 * - `can-join`: the member's own household holds only them and no data, so it can be dropped.
 * - `already-member`: the code is for the household they are in.
 * - `household-in-use`: their household has other members or data; joining would orphan it.
 */
export type JoinEligibility = 'can-join' | 'already-member' | 'household-in-use';

export type InvitePreview = {
  code: string;
  ownerName: string;
  role: InvitableRole;
  eligibility: JoinEligibility;
};

export type MeResponse = {
  userId: string;
  email: string | null;
  role: HouseholdRole;
};
